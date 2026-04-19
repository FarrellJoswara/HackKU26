/**
 * End-to-end test for the on-chain summary flow.
 *
 *   node scripts/testPostSummary.mjs
 *
 * Reads the shared payer wallet from `.env.local` (provisioned by
 * `scripts/setupSolanaWallet.mjs`), builds a sample summary, posts it
 * as an SPL Memo transaction, and prints the live Solana Explorer URL
 * so you can click through and verify the memo on chain.
 *
 * This deliberately re-implements the same logic as
 * `src/core/solana/postSummary.ts` so it can run under plain Node
 * without the Vite/TS toolchain. Keep them in sync.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');

const MEMO_PROGRAM_ID = new PublicKey(
  'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr',
);

function loadEnv() {
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Missing ${envPath}. Run \`npm run solana:setup\` first.`,
    );
  }
  const txt = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

function loadPayer(env) {
  const raw = env.VITE_SOLANA_PAYER_SECRET;
  if (!raw) {
    throw new Error(
      'VITE_SOLANA_PAYER_SECRET not set. Run `npm run solana:setup`.',
    );
  }
  const bytes = Uint8Array.from(JSON.parse(raw));
  if (bytes.length !== 64) {
    throw new Error(`Expected 64-byte secret, got ${bytes.length}.`);
  }
  return Keypair.fromSecretKey(bytes);
}

function resolveCluster(env) {
  const c = (env.VITE_SOLANA_CLUSTER || '').toLowerCase();
  return c === 'devnet' ? 'devnet' : 'testnet';
}

async function postSummary(summary) {
  const env = loadEnv();
  const payer = loadPayer(env);
  const cluster = resolveCluster(env);
  const connection = new Connection(clusterApiUrl(cluster), 'confirmed');

  const memoText = JSON.stringify(summary);
  const memoBytes = new TextEncoder().encode(memoText);
  if (memoBytes.length > 566) {
    throw new Error(
      `Summary memo is ${memoBytes.length} bytes; Solana memo limit is 566.`,
    );
  }

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`Payer balance on ${cluster}: ${balance / 1_000_000_000} SOL`);
  if (balance < 5000) {
    throw new Error(
      `Payer wallet is empty (${balance} lamports). Re-run \`npm run solana:setup\` to top it up.`,
    );
  }

  const tx = new Transaction().add(
    new TransactionInstruction({
      keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoBytes),
    }),
  );
  const bh = await connection.getLatestBlockhash('confirmed');
  tx.recentBlockhash = bh.blockhash;
  tx.feePayer = payer.publicKey;
  tx.sign(payer);

  console.log(`Sending ${memoBytes.length}-byte memo on ${cluster}…`);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    {
      signature: sig,
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    },
    'confirmed',
  );

  return {
    signature: sig,
    cluster,
    payer: payer.publicKey.toBase58(),
    memoBytes: memoBytes.length,
    explorerUrl: `https://explorer.solana.com/tx/${sig}?cluster=${cluster}`,
  };
}

const SAMPLE_SUMMARY = {
  app: 'IslandRun',
  v: 1,
  ts: new Date().toISOString(),
  test: true,
  years: 9,
  netWorth: 312_750,
  winGoal: 250_000,
  startingDebt: 38_500,
  salary: { start: 52_000, end: 88_400 },
  invested: 184_200,
  employerMatch: 24_600,
  debtFreeYear: 6,
  freedomYear: 9,
  topChoice: 'Index Funds',
};

postSummary(SAMPLE_SUMMARY)
  .then((result) => {
    console.log('');
    console.log('Memo confirmed on chain ✓');
    console.log(`  Signature: ${result.signature}`);
    console.log(`  Cluster  : ${result.cluster}`);
    console.log(`  Payer    : ${result.payer}`);
    console.log(`  Bytes    : ${result.memoBytes}`);
    console.log(`  Explorer : ${result.explorerUrl}`);
  })
  .catch((err) => {
    console.error('Post failed:', err);
    process.exit(1);
  });
