/**
 * Vitest setup file — runs once before any test file.
 *
 * Pulls in `@testing-library/jest-dom` matchers (`toBeInTheDocument`,
 * `toHaveAttribute`, …) and stubs a couple of browser APIs jsdom does
 * not implement but our components touch indirectly.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Vitest is configured with `globals: false`, so React Testing Library's
// auto-cleanup-on-afterEach hook isn't installed. Wire it up manually so
// each test gets a clean DOM (no orphaned components from prior tests).
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia; some of our @media-aware code paths
// (e.g. reduced-motion checks) may consult it. Stub a default-ish value.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// PointerEvent ergonomics — jsdom does not ship a complete PointerEvent
// constructor. Tests using `pointerdown` outside-clicks dispatch a real
// event with `{ bubbles: true }`; we don't need to polyfill the full
// API here, just make sure the constructor exists for `new PointerEvent`.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  (window as any).PointerEvent = class PointerEventPolyfill extends Event {
    pointerType: string;
    constructor(type: string, init: PointerEventInit & { pointerType?: string } = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? 'mouse';
    }
  };
}
