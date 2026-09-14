import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readCache,
  writeCache,
  deleteCache,
  isFresh,
  type CacheEntry,
} from "./cache";

/** Minimal in-memory Storage stub (vitest node env has no localStorage). */
function fakeStore(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

describe("cache", () => {
  let store: Storage;

  beforeEach(() => {
    store = fakeStore();
  });

  it("round-trips data with fetchedAt timestamp", () => {
    writeCache("k1", { a: 1 }, store);
    const entry = readCache<{ a: number }>("k1", store);
    expect(entry?.data).toEqual({ a: 1 });
    expect(entry?.fetchedAt).toBeGreaterThan(0);
  });

  it("returns null for missing keys", () => {
    expect(readCache("missing", store)).toBeNull();
  });

  it("returns null for corrupt JSON and ignores it on next read", () => {
    store.setItem("konwenty-nk:v1:bad", "{not json");
    expect(readCache("bad", store)).toBeNull();
    writeCache("bad", "ok", store);
    expect(readCache<string>("bad", store)?.data).toBe("ok");
  });

  it("rejects entries without numeric fetchedAt", () => {
    store.setItem("konwenty-nk:v1:shape", JSON.stringify({ data: [1, 2] }));
    expect(readCache<number[]>("shape", store)).toBeNull();
    store.setItem("konwenty-nk:v1:shape", JSON.stringify("nonsense"));
    expect(readCache("shape", store)).toBeNull();
  });

  it("deleteCache removes the entry", () => {
    writeCache("k", 1, store);
    deleteCache("k", store);
    expect(readCache("k", store)).toBeNull();
  });

  it("isFresh respects TTL", () => {
    const entry: CacheEntry<number> = { data: 1, fetchedAt: Date.now() - 1000 };
    expect(isFresh(entry, 5_000)).toBe(true);
    expect(isFresh(entry, 500)).toBe(false);
    expect(isFresh(null, 5_000)).toBe(false);
  });

  it("handles SSR / no store gracefully", () => {
    expect(readCache("k", null)).toBeNull();
    expect(() => writeCache("k", 1, null)).not.toThrow();
    expect(() => deleteCache("k", null)).not.toThrow();
  });

  it("handles setItem throwing (quota / privacy mode)", () => {
    const throwing = fakeStore();
    vi.spyOn(throwing, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => writeCache("k", 1, throwing)).not.toThrow();
  });

  it("namespaces keys with versioned prefix", () => {
    writeCache("list", [1], store);
    expect(store.getItem("konwenty-nk:v1:list")).not.toBeNull();
    expect(store.getItem("list")).toBeNull();
  });
});