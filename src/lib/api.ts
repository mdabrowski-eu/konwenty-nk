import type { PublicConventDetail, PublicConventList } from "./types";

/**
 * Public Konwenty Planner API client.
 *
 * Read-only GETs against the planner's unauthenticated public endpoints.
 * No credentials are sent (credentials: "omit") — the planner uses Bearer
 * auth, not cookies, so there is nothing to leak cross-origin.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 404) {
        throw new ApiError(404, "Nie znaleziono (konwent niepubliczny lub nie istnieje).");
      }
      throw new ApiError(res.status, `Błąd API: ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(0, "Przekroczono czas oczekiwania na odpowiedź API.");
    }
    throw new ApiError(0, "Nie udało się połączyć z API planera.");
  } finally {
    clearTimeout(timer);
  }
}

/** List all public convents (upcoming and past), sorted by startDate asc. */
export function fetchPublicConvents(): Promise<PublicConventList> {
  return getJson<PublicConventList>("/api/public/convents");
}

/** Full public data for one convent: days, lanes, plan, event catalog. */
export function fetchPublicConvent(slug: string): Promise<PublicConventDetail> {
  return getJson<PublicConventDetail>(
    `/api/public/${encodeURIComponent(slug)}`,
  );
}