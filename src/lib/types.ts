/**
 * Wire types for the Konwenty Planner public API.
 * Mirrors server responses of:
 *   GET /api/public/convents        (list)
 *   GET /api/public/{conventSlug}   (detail)
 * Only the fields the site consumes are modeled.
 */

/** Basic convent info from the list endpoint. */
export type PublicConventSummary = {
  slug: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
};

/** Response of GET /api/public/convents. */
export type PublicConventList = {
  convents: PublicConventSummary[];
};

/** A day within a convent. */
export type ConventDay = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM ("24:00"/"00:00" = runs until midnight) */
  startTime: string;
  endTime: string;
};

/** One lane (ścieżka) of a convent, in display order. */
export type ConventLane = {
  id: string;
  name: string;
  position: number;
};

/** One plan item (entry in the program grid). */
export type PlanItem = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  durationHours: number;
  eventSlug: string;
  eventName?: string | null;
  customName?: string;
  laneId?: string;
};

/** Event catalog entry. */
export type EventSummary = {
  slug: string;
  name: string;
  time: number;
  description: string;
  panelists: string[];
};

/** Response of GET /api/public/{conventSlug}. */
export type PublicConventDetail = {
  convent: {
    slug: string;
    name: string;
    startDate: string;
    endDate: string;
    days: ConventDay[];
    lanes: ConventLane[];
    public: boolean;
  };
  plan: {
    exists: boolean;
    items: PlanItem[];
    planVersion: number;
  };
  events: EventSummary[];
};