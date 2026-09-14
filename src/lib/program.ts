import type {
  ConventDay,
  ConventLane,
  EventSummary,
  PlanItem,
} from "./types";

/**
 * Program-grid logic, ported from the planner's web/src/planner/state.ts
 * (panelists deliberately removed — the showcase site never displays them).
 *
 * Grid model: each convent day produces a list of hourly slots
 * (startTime..endTime exclusive). Plan items are placed into their slot;
 * items that don't fit the grid (off-grid time, unknown/out-of-range lane,
 * slot already taken) land in `strays` and are rendered as a footnote,
 * never dropped silently.
 */

export type PlacedItem = {
  /** Item start time "HH:MM" (== the slot it occupies). */
  startTime: string;
  /** Number of hour slots the item spans. */
  span: number;
  /** Display name: customName ?? eventName ?? catalog name ?? fallback. */
  name: string;
};

/** One lane's column data for a single day. */
export type LaneColumn = {
  laneId: string;
  laneName: string;
  /** slotStart → placed item (undefined = empty cell). */
  cells: Record<string, PlacedItem | undefined>;
};

/** Program table data for one convent day. */
export type DayProgram = {
  date: string;
  slots: string[];
  lanes: LaneColumn[];
  /** Items that could not be placed in the grid (rendered as footnote). */
  strays: Array<{ name: string; startTime: string; laneName: string }>;
};

/** "HH:MM" → minutes since midnight. "24:00" and "00:00" both = end of day. */
export function parseTimeToMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map((x) => Number(x));
  if (hh === 24 && mm === 0) return 24 * 60;
  if (Number.isNaN(hh) || Number.isNaN(mm)) return 0;
  return hh * 60 + mm;
}

export function minutesToTime(mins: number): string {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** Hourly slot list from startTime (incl.) to endTime (excl.). */
export function buildDaySlots(day: Pick<ConventDay, "startTime" | "endTime">): string[] {
  const start = parseTimeToMinutes(day.startTime);
  const isMidnight = /^(00:00|24:00)$/.test(day.endTime.trim());
  const rawEnd = parseTimeToMinutes(day.endTime);
  const end = isMidnight && rawEnd === 0 ? 24 * 60 : rawEnd;
  const slots: string[] = [];
  if (Number.isNaN(start) || end <= start) return slots;
  for (let t = start; t < end; t += 60) {
    slots.push(minutesToTime(t));
  }
  return slots;
}

/** Display name for a plan item — never shows panelists. */
export function displayName(
  item: PlanItem,
  eventsBySlug: Map<string, EventSummary>,
): string {
  const custom = item.customName?.trim();
  if (custom) return custom;
  const fromItem = item.eventName?.trim();
  if (fromItem) return fromItem;
  // Local-FS plans store the event FILE name (e.g. "live-dubbing-3.yaml")
  // while the catalog keys events by slug without the extension. Strip a
  // trailing .yaml/.yml so catalog lookups work in both API modes.
  const lookup = item.eventSlug.replace(/\.(ya?ml)$/i, "");
  const fromCatalog =
    eventsBySlug.get(lookup)?.name?.trim() ??
    eventsBySlug.get(item.eventSlug)?.name?.trim();
  if (fromCatalog) return fromCatalog;
  return "(brak nazwy)";
}

/**
 * Build the per-day program: lanes as columns, hour slots as rows.
 * Follows the planner's placement rules: missing/unknown laneId → first
 * lane; collisions → keep the first, push the rest to strays; items that
 * start outside the grid → strays.
 */
export function buildDayProgram(
  day: ConventDay,
  lanes: ConventLane[],
  items: PlanItem[],
  eventsBySlug: Map<string, EventSummary>,
): DayProgram {
  const slots = buildDaySlots(day);
  const slotSet = new Set(slots);

  const effectiveLanes: ConventLane[] =
    lanes.length > 0
      ? lanes
      : [{ id: "lane-1", name: "Główna", position: 1 }];

  const columns: LaneColumn[] = effectiveLanes.map((lane) => ({
    laneId: lane.id,
    laneName: lane.name,
    cells: {},
  }));
  const strays: DayProgram["strays"] = [];

  const laneById = new Map(columns.map((c) => [c.laneId, c]));

  // Deterministic placement order: by start time, then input order.
  const dayItems = items
    .filter((i) => i.date === day.date)
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  for (const item of dayItems) {
    const name = displayName(item, eventsBySlug);
    const lane = (item.laneId && laneById.get(item.laneId)) || columns[0];
    if (!slotSet.has(item.startTime)) {
      strays.push({ name, startTime: item.startTime, laneName: lane.laneName });
      continue;
    }
    if (lane.cells[item.startTime]) {
      // Collision: keep the first (mirrors planner "best-effort" rule).
      strays.push({ name, startTime: item.startTime, laneName: lane.laneName });
      continue;
    }
    const startIdx = slots.indexOf(item.startTime);
    const span = Math.max(1, Math.min(item.durationHours, slots.length - startIdx));
    lane.cells[item.startTime] = { startTime: item.startTime, span, name };
  }

  return { date: day.date, slots, lanes: columns, strays };
}

/** All programs for a convent, one per day, in day order. */
export function buildPrograms(
  days: ConventDay[],
  lanes: ConventLane[],
  items: PlanItem[],
  events: EventSummary[],
): DayProgram[] {
  const eventsBySlug = new Map(events.map((e) => [e.slug, e]));
  return days.map((day) => buildDayProgram(day, lanes, items, eventsBySlug));
}

/**
 * True when a cell starting EARLIER in this lane spans over the slot at
 * `slotIdx` (i.e. this grid position is already occupied by a rowSpan from
 * above). Rows are NEVER skipped in rendering — every hour keeps its row
 * and label; for covered positions the cell is simply not emitted (the
 * spanning cell covers it). Skipping whole rows would corrupt rowSpan
 * arithmetic (the span would reach over the removed row into the next one).
 */
export function isSlotCovered(
  lane: LaneColumn,
  slots: string[],
  slotIdx: number,
): boolean {
  for (const [start, cell] of Object.entries(lane.cells)) {
    if (!cell) continue;
    const startIdx = slots.indexOf(start);
    if (startIdx !== -1 && startIdx < slotIdx && startIdx + cell.span > slotIdx) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Date helpers (Europe/Warsaw — grouping must not flip a day early/late for
// Polish visitors due to the server/browser timezone)
// ---------------------------------------------------------------------------

/** Today's date (YYYY-MM-DD) in Europe/Warsaw. */
export function warsawToday(): string {
  // en-CA locale yields ISO-like YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

/** True when the convent has ended (endDate strictly before today). */
export function isPast(endDate: string): boolean {
  return endDate < warsawToday();
}

// ---------------------------------------------------------------------------
// Display formatting (Polish)
// ---------------------------------------------------------------------------

const MONTHS_GEN = [
  "stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca",
  "lipca", "sierpnia", "września", "października", "listopada", "grudnia",
];

const WEEKDAYS = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

function parseIsoDate(date: string): Date {
  // Parse as UTC midnight to avoid timezone shifts on YYYY-MM-DD strings.
  return new Date(`${date}T00:00:00Z`);
}

/** "2026-08-21" → "21 sierpnia 2026" (UTC-parsed, locale-safe). */
export function formatFullDate(date: string): string {
  const d = parseIsoDate(date);
  return `${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-08-21" → "piątek" (UTC-parsed weekday). */
export function formatWeekday(date: string): string {
  return WEEKDAYS[parseIsoDate(date).getUTCDay()];
}

/**
 * "2026-08-21".."2026-08-23" → "21–23 sierpnia 2026"
 * (cross-month: "30 sierpnia – 1 września 2026"; cross-year keeps both years).
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const s = parseIsoDate(startDate);
  const e = parseIsoDate(endDate);
  const sameDay = startDate === endDate;
  const sameMonth =
    s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear();
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();

  if (sameDay) return formatFullDate(startDate);
  if (sameMonth) {
    return `${s.getUTCDate()}–${e.getUTCDate()} ${MONTHS_GEN[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
  }
  const startPart = `${s.getUTCDate()} ${MONTHS_GEN[s.getUTCMonth()]}`;
  if (sameYear) {
    return `${startPart} – ${e.getUTCDate()} ${MONTHS_GEN[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
  }
  return `${startPart} ${s.getUTCFullYear()} – ${e.getUTCDate()} ${MONTHS_GEN[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}