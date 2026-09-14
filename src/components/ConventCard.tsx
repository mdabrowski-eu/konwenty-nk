"use client";

import type { PublicConventDetail, PublicConventSummary } from "@/lib/types";
import type { DayProgram } from "@/lib/program";
import { buildPrograms, formatDateRange, isPast } from "@/lib/program";
import { ProgramTable } from "./ProgramTable";

/**
 * One convent in the list: name + date range, click → expand program.
 * The parent (page) owns data fetching: it fetches the detail lazily when
 * a card is first expanded and caches it. Accordion behavior (one open at
 * a time) also lives in the parent.
 */

export type ConventCardProps = {
  summary: PublicConventSummary;
  expanded: boolean;
  /** Cached detail — non-null once loaded. */
  detail: PublicConventDetail | null;
  /** True while the detail fetch is in flight. */
  loading: boolean;
  /** Per-card error message (retryable via onRetry). */
  error: string | null;
  onToggle: () => void;
  onRetry: () => void;
};

export function ConventCard({
  summary,
  expanded,
  detail,
  loading,
  error,
  onToggle,
  onRetry,
}: ConventCardProps) {
  const past = isPast(summary.endDate);
  const accent: "rose" | "ink" = past ? "ink" : "rose";

  let body: React.ReactNode = null;
  if (expanded) {
    if (error) {
      body = (
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-ink/80">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="btn-stamp inline-flex items-center gap-2 bg-paper text-ink px-3 py-1.5 font-display font-extrabold text-[10px] uppercase tracking-[0.18em] border-[2px] border-ink shadow-[4px_4px_0_var(--color-ink)]"
          >
            Spróbuj ponownie
          </button>
        </div>
      );
    } else if (loading || !detail) {
      body = (
        <div className="space-y-2" role="status" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-4 rounded-sm bg-ink/10 animate-pulse"
              style={{ width: `${85 - i * 15}%` }}
            />
          ))}
          <span className="sr-only">Wczytywanie programu…</span>
        </div>
      );
    } else {
      const programs: DayProgram[] = buildPrograms(
        detail.convent.days,
        detail.convent.lanes ?? [],
        detail.plan.items,
        detail.events,
      );
      body = <ProgramTable programs={programs} accent={accent} />;
    }
  }

  return (
    <article
      className={`bg-paper border-[2px] border-ink ${
        past ? "shadow-stamp-mint opacity-90" : "shadow-stamp-rose"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-4 py-4 md:px-6 md:py-5 flex items-center justify-between gap-4 group"
      >
        <div>
          <h3 className="font-display font-extrabold text-lg md:text-2xl leading-tight text-ink group-hover:text-rose transition-colors">
            {summary.name}
          </h3>
          <p className="mt-1 text-sm md:text-base text-ink/70">
            {formatDateRange(summary.startDate, summary.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {past && (
            <span className="inline-block px-2 py-0.5 bg-mint text-ink font-display text-[9px] md:text-[10px] font-extrabold uppercase tracking-[0.18em] border border-ink">
              archiwalne
            </span>
          )}
          <span
            aria-hidden
            className={`font-display font-extrabold text-xl transition-transform duration-200 ${
              expanded ? "rotate-180" : ""
            }`}
          >
            ▾
          </span>
        </div>
      </button>
      {body !== null && (
        <div className="px-4 pb-5 md:px-6 md:pb-6 border-t-[2px] border-dashed border-ink/30 pt-4">
          {body}
        </div>
      )}
    </article>
  );
}