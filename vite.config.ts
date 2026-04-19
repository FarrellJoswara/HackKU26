/**
 * @file Vite configuration for the dev server and production bundle.
 *
 * Defines the `@` path alias to `./src` (mirrored in `vitest.config.ts` for
 * tests) and enables React + Tailwind v4 plugins.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
