/**
 * Minimal external store persisted to localStorage.
 *
 * Used with useSyncExternalStore: `getSnapshot` returns a cached immutable
 * array so React can bail out correctly; the server snapshot is provided
 * separately by the caller. Writes persist asynchronously after the state
 * updates, and cross-tab changes flow back in through the `storage` event.
 */
export interface ExternalStore<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
  update: (recipe: (current: T) => T) => void;
}

export function createStore<T>(options: {
  storageKey: string;
  validate: (raw: unknown) => T;
}): ExternalStore<T> & { hydrate: () => void } {
  const { storageKey, validate } = options;

  let snapshot: T | null = null; // null = not yet hydrated
  const listeners = new Set<() => void>();

  const hasWindow = typeof window !== "undefined";

  function read(): T {
    if (!hasWindow) return validate(null);
    try {
      const raw = window.localStorage.getItem(storageKey);
      return validate(raw ? JSON.parse(raw) : null);
    } catch {
      return validate(null);
    }
  }

  function ensureHydrated(): T {
    if (snapshot === null) snapshot = read();
    return snapshot;
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      if (hasWindow) {
        const onStorage = (event: StorageEvent) => {
          if (event.key === storageKey) {
            snapshot = read();
            listener();
          }
        };
        window.addEventListener("storage", onStorage);
        return () => {
          listeners.delete(listener);
          window.removeEventListener("storage", onStorage);
        };
      }
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return ensureHydrated();
    },

    update(recipe) {
      const next = recipe(ensureHydrated());
      snapshot = next;
      listeners.forEach((listener) => listener());
      if (hasWindow) {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch {
          // Storage full/blocked — cart still works in memory.
        }
      }
    },

    /** Force re-read from storage (e.g. after clearing on order success). */
    hydrate() {
      snapshot = null;
    },
  };
}
