/**
 * Vitest config — kept separate from `vite.config.ts` so the production
 * dev/build pipeline does not pull in test-only plugins or types.
 *
 * Mirrors the alias `@ -> ./src` so test files import the same way the
 * app does. `jsdom` powers the React component tests; pure-core tests
 * also run in the same env (they don't touch the DOM either way).
 *
 * No tests target `src/games/IslandRun/main.ts` — Three.js is not safe
 * to evaluate under jsdom and that lives in the imperative game layer.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // We do NOT enable `globals: true` — tests import { describe, it, expect }
    // explicitly so the project tsconfig stays untouched (no global ambient
    // types added, no `noUnusedLocals` surprises).
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Safety net — never let a Three.js / WebGL import slip into a test.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/games/IslandRun/main.ts',
      'src/games/IslandRun/index.tsx',
    ],
    css: false,
  },
});
