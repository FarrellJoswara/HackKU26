/**
 * One-shot setup for the shared Solana payer wallet that every player
 * uses to post their playthrough summary on chain.
 *
 *   node scripts/setupSolanaWallet.mjs
 *
 * What this does:
 *  1. Reuses the existing keypair stored in `.env.local` if present;
 *     otherwise generates a fresh one.
 *  2. Tries to top the wallet up to ~1 SOL on testnet first, falling
 *     back to devnet if testnet's faucet rate-limits us (very common
 *     for hackathon demos).
 *  3. Writes the secret key + chosen cluster into `.env.local` so the
 *     Vite app picks them up via `import.meta.env` (including on Vercel).
 *
 * The payer only ever holds testnet / devnet "play" SOL — never mainnet.
 * `.env.local` is tracked in git on purpose for zero-config deploys.
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from '@solana/web3.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');

const MIN_LAMPORTS = LAMPORTS_PER_SOL / 10; // 0.1 SOL "good enough" floor
const AIRDROP_REQUEST = LAMPORTS_PER_SOL; // 1 SOL — faucets may give less

const CLUSTER_ORDER = ['testnet', 'devnet'];

function loadExistingPayer() {
  if (!fs.existsSync(envPath)) return null;
  const txt = fs.readFileSync(envPath, 'utf8');
  const m = txt.match(/^VITE_SOLANA_PAYER_SECRET=(.+)$/m);
  if (!m) return null;
  try {
    const bytes = Uint8Array.from(JSON.parse(m[1]));
    if (bytes.length !== 64) return null;
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

function writeEnv(payer, cluster) {
  const secretJson = JSON.stringify(Array.from(payer.secretKey));
  const body = [
    '# Shared Solana payer (devnet/testnet play SOL only). Committed for Vercel builds.',
    '# Regenerate: npm run solana:setup',
    `VITE_SOLANA_PAYER_SECRET=${secretJson}`,
    `VITE_SOLANA_CLUSTER=${cluster}`,
    '',
  ].join('\n');
  fs.writeFileSync(envPath, body);
}

async function tryAirdropOnce(conn, payer) {
  const sig = await conn.requestAirdrop(payer.publicKey, AIRDROP_REQUEST);
  const bh = await conn.getLatestBlockhash('confirmed');
  await conn.confirmTransaction(
    {
      signature: sig,
      blockhash: bh.blockhash,
      lastValidBlockHeight: bh.lastValidBlockHeight,
    },
    'confirmed',
  );
  return conn.getBalance(payer.publicKey);
}

async function ensureFunded(payer) {
  // Try a few times across both clusters: testnet's faucet sometimes
  // throws transient "Internal error", and devnet's public faucet
  // gates aggressively (HTTP 429). Two passes with a small back-off
  // is usually enough to slip through.
  const attempts = [
    { cluster: 'testnet', delay: 0 },
    { cluster: 'devnet', delay: 0 },
    { cluster: 'testnet', delay: 5_000 },
    { cluster: 'devnet', delay: 10_000 },
  ];

  let lastErr = null;
  for (const { cluster, delay } of attempts) {
    if (delay > 0) {
      console.log(`Waiting ${delay / 1000}s before retrying…`);
      await new Promise((r) => setTimeout(r, delay));
    }
    const conn = new Connection(clusterApiUrl(cluster), 'confirmed');
    let balance = 0;
    try {
      balance = await conn.getBalance(payer.publicKey);
    } catch (err) {
      console.warn(`[${cluster}] balance check failed: ${err.message}`);
      lastErr = err;
      continue;
    }
    console.log(
      `[${cluster}] current balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
    );
    if (balance >= MIN_LAMPORTS) {
      return { cluster, balance, manual: false };
    }
    try {
      console.log(`[${cluster}] requesting airdrop of 1 SOL…`);
      const newBalance = await tryAirdropOnce(conn, payer);
      console.log(
        `[${cluster}] airdrop confirmed; new balance ${(newBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
      );
      if (newBalance >= MIN_LAMPORTS) {
        return { cluster, balance: newBalance, manual: false };
      }
    } catch (err) {
      console.warn(`[${cluster}] airdrop failed: ${err.message}`);
      lastErr = err;
    }
  }
  // Both faucets refused us. Fall back to a "manual fund" mode: keep
  // the keypair, default to devnet (which the web faucet always
  // honors), and surface a clickable link the user can visit.
  console.warn(
    `\nCould not auto-fund the wallet (last error: ${lastErr ? lastErr.message : 'unknown'}).`,
  );
  console.warn('Falling back to manual funding via the official web faucet.');
  return { cluster: 'devnet', balance: 0, manual: true };
}

async function main() {
  let payer = loadExistingPayer();
  if (payer) {
    console.log(`Reusing existing payer: ${payer.publicKey.toBase58()}`);
  } else {
    payer = Keypair.generate();
    console.log(`Generated new payer: ${payer.publicKey.toBase58()}`);
  }

  const { cluster, balance, manual } = await ensureFunded(payer);
  writeEnv(payer, cluster);

  const address = payer.publicKey.toBase58();
  const explorerAddr = `https://explorer.solana.com/address/${address}?cluster=${cluster}`;
  const faucetUrl = `https://faucet.solana.com/?walletAddress=${address}&cluster=${cluster}`;

  console.log('');
  if (manual) {
    console.log('Wallet keypair saved, but auto-airdrop was rate-limited.');
  } else {
    console.log('Wallet ready ✓');
  }
  console.log(`  Address : ${address}`);
  console.log(`  Cluster : ${cluster}`);
  console.log(`  Balance : ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  console.log(`  Explorer: ${explorerAddr}`);
  console.log(`  Env file: ${envPath}`);
  console.log('');
  if (manual) {
    console.log('To finish funding, open the official web faucet:');
    console.log(`  ${faucetUrl}`);
    console.log('Click "Devnet" → enter the address above → request 1 SOL.');
    console.log(
      'Then re-run `npm run solana:setup` (it will reuse the same keypair and confirm the balance) or just `npm run solana:test`.',
    );
  } else {
    console.log(
      'Restart `npm run dev` so Vite picks up the new env vars, then play through to see the on-chain link on the recap screen.',
    );
    console.log(
      'Run this script again any time the balance drops to top the wallet back up.',
    );
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
