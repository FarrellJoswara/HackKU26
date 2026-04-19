/**
 * Export the shared payer's secret key from `.env.local` to a temp
 * Solana-CLI-compatible keypair file so external tools like
 * `devnet-pow` (which can only read keypair files, not env vars) can
 * use it.
 *
 *   node scripts/exportPayerKeypair.mjs [outPath]
 *
 * The output file is written with the standard Solana JSON array
 * format (64-byte secret key). Delete it after use — it's the same
 * key the game uses in the browser, so treat it accordingly.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '..', '.env.local');
const outPath = path.resolve(
  process.argv[2] ?? path.resolve(__dirname, '..', '.solana-payer.json'),
);

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}. Run \`npm run solana:setup\` first.`);
  process.exit(1);
}

const txt = fs.readFileSync(envPath, 'utf8');
const match = txt.match(/^VITE_SOLANA_PAYER_SECRET=(.+)$/m);
if (!match) {
  console.error('VITE_SOLANA_PAYER_SECRET not found in .env.local');
  process.exit(1);
}

const parsed = JSON.parse(match[1]);
if (!Array.isArray(parsed) || parsed.length !== 64) {
  console.error('VITE_SOLANA_PAYER_SECRET must be a 64-byte JSON array.');
  process.exit(1);
}

fs.writeFileSync(outPath, JSON.stringify(parsed));
console.log(`Wrote keypair to ${outPath}`);
