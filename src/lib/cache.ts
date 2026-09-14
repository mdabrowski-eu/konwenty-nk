/**
 * Tiny localStorage-backed cache with stale-while-revalidate semantics.
 *
 * Pattern (per plan §13 / user request): render cached ("stale") data
 * immediately, revalidate in the background, swap when fresh arrives.
 * If revalidation fails, stale data stays visible instead of an error.
 *
 * Keys are versioned (PREFIX v1) — bump the version when the wire format
 * changes so old entries are ignored, never mis-parsed.
 *
 * All functions are SSR-safe (no-op without window) and never throw:
 * quota errors / privacy modes degrade to "no cache".
 */

const PREFIX = "konwenty-nk:v1:";

export type CacheEntry<T> = {
  data: T;
  /** Epoch ms when the data was fetched. */
  fetchedAt: number;
};

function defaultStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readCache<T>(
  key: string,
  store: Storage | null = defaultStore(),
): CacheEntry<T> | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      typeof parsed.fetchedAt !== "number" ||
      !("data" in parsed)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null; // corrupt entry — treat as absent
  }
}

export function writeCache<T>(
  key: string,
  data: T,
  store: Storage | null = defaultStore(),
): void {
  if (!store) return;
  try {
    const entry: CacheEntry<T> = { data, fetchedAt: Date.now() };
    store.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota exceeded / privacy mode — caching is best-effort
  }
}

export function deleteCache(
  key: string,
  store: Storage | null = defaultStore(),
): void {
  if (!store) return;
  try {
    store.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

/** True when the entry is younger than ttlMs. */
export function isFresh<T>(entry: CacheEntry<T> | null, ttlMs: number): boolean {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < ttlMs;
}