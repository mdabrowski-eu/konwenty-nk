"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConventCard } from "@/components/ConventCard";
import { fetchPublicConvents, fetchPublicConvent, ApiError } from "@/lib/api";
import type { PublicConventDetail } from "@/lib/types";

const DISCORD_URL = "https://discord.com/invite/nanokarrin";

type Status = "idle" | "loading" | "error" | "ready";

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<
    Array<{ slug: string; name: string; startDate: string; endDate: string }>
  >([]);
  const [details, setDetails] = useState<Map<string, PublicConventDetail>>(new Map());
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [detailErrors, setDetailErrors] = useState<Map<string, string>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());

  // "Today" computed on first render (client-only component; fine for a
  // static-exported SPA — see plan §8.2).
  const now = useMemo(() => Date.now(), []);

  const loadList = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const list = await fetchPublicConvents();
      setSummaries(list.convents);
      setStatus("ready");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Nie udało się połączyć z API planera.",
      );
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Deep link: ?konwent=<slug> → expand that convent after load.
  useEffect(() => {
    if (status !== "ready") return;
    const slug = new URLSearchParams(window.location.search).get("konwent");
    if (slug && summaries.some((c) => c.slug === slug)) {
      void toggle(slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /** Lazy detail fetch + cache. Accordion: one card open at a time. */
  const toggle = useCallback(
    async (slug: string) => {
      const next = expandedSlug === slug ? null : slug;
      setExpandedSlug(next);
      if (next === null) return;

      if (details.has(slug) || inFlight.current.has(slug)) return;
      inFlight.current.add(slug);
      setLoadingSlug(slug);
      setDetailErrors((prev) => {
        const nextErrors = new Map(prev);
        nextErrors.delete(slug);
        return nextErrors;
      });
      try {
        const detail = await fetchPublicConvent(slug);
        setDetails((prev) => new Map(prev).set(slug, detail));
      } catch (err) {
        setDetailErrors((prev) =>
          new Map(prev).set(
            slug,
            err instanceof ApiError && err.status === 404
              ? "Ten konwent jest niepubliczny lub nie istnieje."
              : err instanceof ApiError
                ? err.message
                : "Nie udało się wczytać programu.",
          ),
        );
      } finally {
        inFlight.current.delete(slug);
        setLoadingSlug((cur) => (cur === slug ? null : cur));
      }
    },
    [expandedSlug, details],
  );

  const retryDetail = useCallback(
    (slug: string) => {
      setDetailErrors((prev) => {
        const next = new Map(prev);
        next.delete(slug);
        return next;
      });
      // Force a fresh fetch by dropping the cached detail, then toggle reopen.
      setDetails((prev) => {
        const next = new Map(prev);
        next.delete(slug);
        return next;
      });
      setExpandedSlug(null);
      // Let state settle, then reopen (fetch runs in toggle).
      window.setTimeout(() => {
        void toggle(slug);
      }, 0);
    },
    [toggle],
  );

  // Split into upcoming / archive. Grouping is computed once per list load;
  // `now` is captured at mount so a long-open tab stays stable until reload.
  const { upcoming, archive } = useMemo(() => {
    const todayIso = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Warsaw",
    }).format(new Date(now));
    const upcoming = summaries.filter((c) => c.endDate >= todayIso);
    const archive = summaries.filter((c) => c.endDate < todayIso);
    return { upcoming, archive }; // lists arrive sorted asc from the API
  }, [summaries, now]);

  const section = (
    title: string,
    list: typeof summaries,
    past: boolean,
  ): React.ReactNode => {
    if (list.length === 0) {
      return (
        <p className="font-accent italic text-lg text-ink/70">
          {past ? "Archiwum jest jeszcze puste." : "Nic tu jeszcze nie ma — ale wkrótce!"}
        </p>
      );
    }
    return (
      <div className="space-y-4">
        {list.map((c) => (
          <ConventCard
            key={c.slug}
            summary={c}
            expanded={expandedSlug === c.slug}
            detail={details.get(c.slug) ?? null}
            loading={loadingSlug === c.slug}
            error={detailErrors.get(c.slug) ?? null}
            onToggle={() => void toggle(c.slug)}
            onRetry={() => retryDetail(c.slug)}
          />
        ))}
      </div>
    );
  };

  return (
    <main className="relative z-10 flex flex-col">
      {/* === NAV === */}
      <header className="px-6 md:px-10 pt-6 md:pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block w-3 h-3 rounded-full bg-rose animate-pulse-glove" />
          <span className="font-display font-extrabold tracking-tight text-ink text-sm md:text-base uppercase">
            NanoKarrin
          </span>
        </div>
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-stamp inline-flex items-center gap-2 bg-paper text-ink px-3 py-2 font-display font-extrabold text-[10px] md:text-xs uppercase tracking-[0.18em] border-[2px] border-ink shadow-[4px_4px_0_var(--color-ink)]"
          aria-label="Dołącz do Discorda NanoKarrin"
        >
          <span>Discord</span>
        </a>
      </header>

      {/* === HERO === */}
      <section className="px-6 md:px-10 pt-10 md:pt-14 pb-8 md:pb-10">
        <div className="max-w-[1280px] mx-auto">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-ink text-paper font-display text-[10px] md:text-xs tracking-[0.22em] uppercase">
            <span className="w-2 h-2 bg-rose rounded-full" /> konwenty
          </span>
          <h1 className="mt-6 font-display font-black leading-[0.85] tracking-[-0.03em] text-ink">
            <span className="block text-[13vw] md:text-[8vw] lg:text-[6.5rem] animate-rise">
              GDZIE
            </span>
            <span
              className="block text-[13vw] md:text-[8vw] lg:text-[6.5rem] outlined-text animate-rise"
              style={{ animationDelay: "0.15s" }}
            >
              JEDZIEMY
            </span>
          </h1>
          <p
            className="mt-6 max-w-xl text-lg md:text-xl leading-snug text-ink/85 animate-rise"
            style={{ animationDelay: "0.3s" }}
          >
            Wszystkie konwenty, {" "}
            <span className="font-accent italic text-rose text-2xl md:text-3xl">
              przyszłe i zakończone,
            </span>{" "}
            w których NanoKarrin bierze lub brało udział. Kliknij konwent, aby zobaczyć nasz program.
          </p>
        </div>
      </section>

      {/* === LIST === */}
      <section className="px-6 md:px-10 py-10 md:py-14">
        <div className="max-w-[1280px] mx-auto space-y-10">
          {status === "loading" && (
            <div className="space-y-4" role="status" aria-busy="true">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-paper border-[2px] border-ink shadow-stamp-mint animate-pulse"
                />
              ))}
              <span className="sr-only">Wczytywanie listy konwentów…</span>
            </div>
          )}

          {status === "error" && (
            <div className="bg-paper border-[2px] border-ink shadow-stamp p-6 md:p-8">
              <h2 className="font-display font-extrabold text-lg md:text-xl text-ink">
                Ups — nie udało się wczytać listy konwentów.
              </h2>
              <p className="mt-2 text-sm md:text-base text-ink/80">{error}</p>
              <button
                type="button"
                onClick={() => void loadList()}
                className="btn-stamp mt-5 inline-flex items-center gap-2 bg-rose text-paper px-5 py-3 font-display font-extrabold uppercase tracking-wide text-sm border-[3px] border-ink shadow-stamp"
              >
                Spróbuj ponownie <span aria-hidden>→</span>
              </button>
            </div>
          )}

          {status === "ready" && (
            <>
              <section aria-labelledby="upcoming-heading">
                <h2
                  id="upcoming-heading"
                  className="font-display font-black text-2xl md:text-4xl uppercase tracking-tight text-ink mb-5 flex items-center gap-3"
                >
                  <span className="inline-block w-3 h-3 rounded-full bg-rose animate-pulse-glove" />
                  Nadchodzące
                </h2>
                {section("Nadchodzące", upcoming, false)}
              </section>

              <section
                aria-labelledby="archive"
                className="pt-2 border-t-[3px] border-dashed border-ink/40"
              >
                <h2
                  id="archive"
                  className="font-display font-black text-2xl md:text-4xl uppercase tracking-tight text-ink/70 mb-5 mt-8 flex items-center gap-3"
                >
                  <span className="inline-block w-3 h-3 rounded-full bg-mint" />
                  Archiwum
                </h2>
                <p className="font-accent italic text-base md:text-lg text-ink/60 -mt-3 mb-5">
                  Archiwum jest niekompletne, prowadzimy je dopiero od nowszych
                  konwentów. NanoKarrin jeździ na konwenty od wielu lat i było na wieludziesięciu imprezach w całej Polsce.
                </p>
                {section("Archiwum", [...archive].reverse(), true)}
              </section>
            </>
          )}
        </div>
      </section>

      {/* === FOOTER === */}
      <footer className="px-6 md:px-10 pb-10 mt-auto">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <p className="font-display text-[10px] md:text-xs uppercase tracking-[0.18em] text-ink/60">
            NanoKarrin — polska grupa dubbingowa
          </p>
          <p className="text-[10px] md:text-xs text-ink/50">
            Program może się zmienić
          </p>
        </div>
      </footer>
    </main>
  );
}