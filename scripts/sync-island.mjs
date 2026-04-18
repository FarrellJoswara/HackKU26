/**
 * Rebuilds IslandBoardWeb and copies Vite output into `public/island-board/`.
 *
 * Expects this repo and IslandBoardWeb to live as siblings:
 *   HackKU26/          (this project — run script from here)
 *   IslandBoardWeb/
 *
 * Usage: node scripts/sync-island.mjs
 */

import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const islandProject = path.join(root, '..', 'IslandBoardWeb');
const dist = path.join(islandProject, 'dist');
const out = path.join(root, 'public', 'island-board');

if (!existsSync(path.join(islandProject, 'package.json'))) {
  console.error(
    '[sync-island] IslandBoardWeb not found next to this repo:',
    islandProject,
  );
  process.exit(1);
}

console.log('[sync-island] npm run build →', islandProject);
execSync('npm run build', { cwd: islandProject, stdio: 'inherit' });

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(dist, out, { recursive: true });
console.log('[sync-island] copied →', out);

/** Vite defaults to `/assets/` + absolute `/textures/...` — wrong when this app is served under `/island-board/`. */
function patchForSubfolderEmbed() {
  const indexPath = path.join(out, 'index.html');
  if (existsSync(indexPath)) {
    let html = readFileSync(indexPath, 'utf8');
    html = html.replaceAll('src="/assets/', 'src="assets/').replaceAll('href="/assets/', 'href="assets/');
    writeFileSync(indexPath, html);
    console.log('[sync-island] patched index.html (relative /assets paths)');
  }

  const assetsDir = path.join(out, 'assets');
  if (existsSync(assetsDir)) {
    for (const name of readdirSync(assetsDir)) {
      if (!name.endsWith('.js')) continue;
      const p = path.join(assetsDir, name);
      let js = readFileSync(p, 'utf8');
      if (!js.includes('/textures/')) continue;
      js = js.replaceAll('/textures/', 'textures/');
      writeFileSync(p, js);
      console.log('[sync-island] patched', path.relative(root, p), '(/textures → relative)');
    }
  }
}

patchForSubfolderEmbed();
