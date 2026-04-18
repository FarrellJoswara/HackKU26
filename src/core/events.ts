/**
 * Tiny typed Pub/Sub Event Bus. Framework-agnostic — no React import in
 * the core implementation so it can be called from R3F render loops,
 * Howler callbacks, or plain functions.
 *
 * Why a bus and not just Zustand? Zustand is great for state but events
 * are *fire-and-forget signals* (e.g. "player took damage", "transition
 * finished") that should not pollute persisted state. Use the right tool:
 *
 *   - Persistent / queryable data ............ Zustand store
 *   - One-shot signals between modules ....... Event Bus
 */

import { useEffect } from 'react';
import type { EventHandler, EventKey, EventMap } from './types';

type AnyHandler = (payload: unknown) => void;

class EventBus {
  private handlers = new Map<EventKey, Set<AnyHandler>>();

  on<K extends EventKey>(type: K, handler: EventHandler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(type, handler);
  }

  off<K extends EventKey>(type: K, handler: EventHandler<K>): void {
    const set = this.handlers.get(type);
    if (!set) return;
    set.delete(handler as AnyHandler);
    if (set.size === 0) this.handlers.delete(type);
  }

  once<K extends EventKey>(type: K, handler: EventHandler<K>): () => void {
    const off = this.on(type, ((payload: EventMap[K]) => {
      off();
      handler(payload);
    }) as EventHandler<K>);
    return off;
  }

  emit<K extends EventKey>(type: K, payload: EventMap[K]): void {
    const set = this.handlers.get(type);
    if (!set || set.size === 0) return;
    for (const h of [...set]) {
      try {
        (h as EventHandler<K>)(payload);
      } catch (err) {
        console.error(`[events] handler for "${String(type)}" threw`, err);
      }
    }
  }

  /** Test/HMR helper. */
  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();

/**
 * React convenience: subscribe to a typed event for the lifetime of the
 * component. The handler is intentionally not in the dep array — wrap it
 * in `useCallback` if your handler closes over changing values.
 */
export function useEventBus<K extends EventKey>(
  type: K,
  handler: EventHandler<K>,
): void {
  useEffect(() => {
    return eventBus.on(type, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);
}
