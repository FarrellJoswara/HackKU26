/**
 * Post a playthrough summary to a Solana cluster as an SPL Memo
 * transaction.
 *
 * The memo program (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) is
 * a tiny on-chain program that records arbitrary UTF-8 text into a
 * transaction's instruction data, where it shows up in the program
 * logs on Solana Explorer. We use it here to put a JSON snapshot of
 * the run results on chain so we can deep-link to the transaction
 * from the playthrough summary screen.
 *
 * Authentication model:
 *  - The game ships with a single shared payer wallet (testnet/devnet
 *    play SOL — never mainnet) injected via Vite env vars. Every
 *    player's browser signs with this same key.
 *  - This is intentional for the hackathon demo — it removes the need
 *    for per-player faucet airdrops or wallet extensions. Don't reuse
 *    this pattern on mainnet, ever.
 *
 *  Setup:
 *    npm run solana:setup     # generates + funds the wallet, writes .env.local
 *
 * Per AGENTS.md §3, this lives in `src/core/` because it's a shared
 * service with no React / DOM / 3D dependencies.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js';

export type SolanaCluster = 'testnet' | 'devnet';

export interface PostSummaryResult {
  signature: string;
  cluster: SolanaCluster;
  explorerUrl: string;
  memoBytes: number;
  payer: string;
}

/**
 * SPL Memo Program v2 — same address on every public cluster.
 * https://spl.solana.com/memo
 */
const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);

/** Solana caps a single memo instruction at 566 UTF-8 bytes. */
const MAX_MEMO_BYTES = 566;

interface ImportMetaEnvLike {
  VITE_SOLANA_PAYER_SECRET?: string;
  VITE_SOLANA_CLUSTER?: string;
}

function readEnv(): ImportMetaEnvLike {
  // `import.meta.env` is replaced at build time by Vite. Wrap in a
  // try so this module still imports cleanly under Node-driven tests.
  try {
    return (import.meta as unknown as { env?: ImportMetaEnvLike }).env ?? {};
  } catch {
    return {};
  }
}

function resolveCluster(): SolanaCluster {
  const raw = readEnv().VITE_SOLANA_CLUSTER?.trim().toLowerCase();
  return raw === 'devnet' ? 'devnet' : 'testnet';
}

let cachedPayer: Keypair | null = null;

function loadPayer(): Keypair {
  if (cachedPayer) return cachedPayer;
  const raw = readEnv().VITE_SOLANA_PAYER_SECRET?.trim();
  if (!raw) {
    throw new Error(
      'Missing VITE_SOLANA_PAYER_SECRET — run `npm run solana:setup` to provision the shared wallet.',
    );
  }
  let bytes: Uint8Array;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    bytes = Uint8Array.from(parsed as number[]);
  } catch (err) {
    throw new Error(
      `VITE_SOLANA_PAYER_SECRET must be a JSON array of 64 bytes (${(err as Error).message}).`,
    );
  }
  if (bytes.length !== 64) {
    throw new Error(
      `VITE_SOLANA_PAYER_SECRET must be 64 bytes; got ${bytes.length}.`,
    );
  }
  cachedPayer = Keypair.fromSecretKey(bytes);
  return cachedPayer;
}

export function getSharedPayerAddress(): string | null {
  try {
    return loadPayer().publicKey.toBase58();
  } catch {
    return null;
  }
}

export async function postSummaryToSolana(
  summary: unknown,
): Promise<PostSummaryResult> {
  await ensureBufferPolyfill();

  const memoText = JSON.stringify(summary);
  const memoBytes = new TextEncoder().encode(memoText);
  if (memoBytes.length > MAX_MEMO_BYTES) {
    throw new Error(
      `Summary memo is ${memoBytes.length} bytes; Solana memo limit is ${MAX_MEMO_BYTES}.`,
    );
  }

  const payer = loadPayer();
  const cluster = resolveCluster();
  const connection = new Connection(clusterApiUrl(cluster), 'confirmed');

  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      // The Buffer global is guaranteed by `ensureBufferPolyfill()` above.
      data: Buffer.from(memoBytes),
    }),
  );

  const blockhash = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = blockhash.blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    'confirmed',
  );

  return {
    signature,
    cluster,
    explorerUrl: `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`,
    memoBytes: memoBytes.length,
    payer: payer.publicKey.toBase58(),
  };
}

let bufferPolyfillPromise: Promise<void> | null = null;

/**
 * `@solana/web3.js` v1.x serializes transactions through Node's
 * `Buffer`. Vite does not polyfill node globals, so we lazy-load the
 * userland `buffer` package (already a transitive dependency) and pin
 * it on `globalThis` the first time we need to talk to Solana.
 */
function ensureBufferPolyfill(): Promise<void> {
  if (typeof (globalThis as { Buffer?: unknown }).Buffer !== 'undefined') {
    return Promise.resolve();
  }
  if (!bufferPolyfillPromise) {
    bufferPolyfillPromise = import('buffer').then(({ Buffer }) => {
      (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
    });
  }
  return bufferPolyfillPromise;
}
