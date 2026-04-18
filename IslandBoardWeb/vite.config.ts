import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const islandRoot = path.dirname(fileURLToPath(import.meta.url));

/** Production build is copied into HackKU26 `public/island-board/` — keep asset URLs rooted there. */
export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  base: mode === 'production' ? '/island-board/' : '/',
  resolve: {
    alias: {
      '@hackku/scenarios': path.resolve(islandRoot, '../src/core/scenarios/index.ts'),
    },
  },
  server: { port: 5180, open: false },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
}));
