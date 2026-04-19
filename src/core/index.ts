/**
 * @file Public barrel for `@/core` — re-exports shared types, scenario helpers,
 * the event bus, and the Zustand store. Prefer importing from here or from a
 * specific submodule (`@/core/store`) depending on tree-shaking needs.
 */

export * from './types';
export * from './budgetTypes';
export * from './scenarios';
export * from './events';
export * from './store';
