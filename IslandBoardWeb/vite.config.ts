import { defineConfig } from 'vite';

/** Production build is copied into HackKU26 `public/island-board/` — keep asset URLs rooted there. */
export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  base: mode === 'production' ? '/island-board/' : '/',
  server: { port: 5180, open: false },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
}));
