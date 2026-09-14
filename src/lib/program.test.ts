import { describe, it, expect } from "vitest";
import {
  parseTimeToMinutes,
  minutesToTime,
  buildDaySlots,
  displayName,
  buildDayProgram,
  buildPrograms,
  warsawToday,
  isPast,
  formatFullDate,
  formatWeekday,
  formatDateRange,
} from "./program";
import type { ConventDay, ConventLane, EventSummary, PlanItem } from "./types";

const DAY: ConventDay = { date: "2026-08-21", startTime: "17:00", endTime: "22:00" };
const LANE_A: ConventLane = { id: "lane-a", name: "Sala A", position: 1 };
const LANE_B: ConventLane = { id: "lane-b", name: "Sala B", position: 2 };
const EVENTS: EventSummary[] = [
  { slug: "koncert", name: "Koncert NanoKarrin", time: 1, description: "", panelists: [] },
];
const NO_EVENTS = new Map<string, EventSummary>();

function item(partial: Partial<PlanItem> & { startTime: string }): PlanItem {
  return {
    date: DAY.date,
    durationHours: 1,
    eventSlug: "koncert",
    eventName: "Koncert NanoKarrin",
    ...partial,
  } as PlanItem;
}

describe("parseTimeToMinutes", () => {
  it("parses HH:MM", () => {
    expect(parseTimeToMinutes("17:30")).toBe(17 * 60 + 30);
  });
  it("treats 24:00 as end of day", () => {
    expect(parseTimeToMinutes("24:00")).toBe(1440);
  });
  it("treats 00:00 as midnight (not end marker by itself here)", () => {
    // 00:00 alone is 0 — the midnight-as-end aliasing happens in buildDaySlots.
    expect(parseTimeToMinutes("00:00")).toBe(0);
  });
  it("returns 0 for garbage", () => {
    expect(parseTimeToMinutes("xx:yy")).toBe(0);
  });
});

describe("minutesToTime", () => {
  it("pads hours", () => {
    expect(minutesToTime(9 * 60 + 5)).toBe("09:05");
  });
  it("formats 24:00", () => {
    expect(minutesToTime(24 * 60)).toBe("24:00");
  });
});

describe("buildDaySlots", () => {
  it("builds hourly slots, endTime exclusive", () => {
    expect(buildDaySlots({ startTime: "17:00", endTime: "22:00" })).toEqual([
      "17:00", "18:00", "19:00", "20:00", "21:00",
    ]);
  });
  it("handles 00:00 as runs-until-midnight", () => {
    expect(buildDaySlots({ startTime: "22:00", endTime: "00:00" })).toEqual([
      "22:00", "23:00",
    ]);
  });
  it("handles 24:00 as end of day", () => {
    expect(buildDaySlots({ startTime: "22:00", endTime: "24:00" })).toEqual([
      "22:00", "23:00",
    ]);
  });
  it("returns empty for inverted ranges", () => {
    expect(buildDaySlots({ startTime: "20:00", endTime: "10:00" })).toEqual([]);
  });
});

describe("displayName", () => {
  it("prefers customName", () => {
    expect(
      displayName(item({ startTime: "10:00", customName: "Wersja live" }), new Map()),
    ).toBe("Wersja live");
  });
  it("falls back to itemName", () => {
    expect(displayName(item({ startTime: "10:00" }), new Map())).toBe(
      "Koncert NanoKarrin",
    );
  });
  it("falls back to catalog name", () => {
    expect(
      displayName(
        { ...item({ startTime: "10:00" }), eventName: null },
        new Map(EVENTS.map((e) => [e.slug, e])),
      ),
    ).toBe("Koncert NanoKarrin");
  });
  it("strips .yaml extension from slugs before catalog lookup (local FS mode)", () => {
    expect(
      displayName(
        { ...item({ startTime: "10:00", eventSlug: "koncert.yaml" }), eventName: null },
        new Map(EVENTS.map((e) => [e.slug, e])),
      ),
    ).toBe("Koncert NanoKarrin");
  });
  it("uses (brak nazwy) when nothing resolves", () => {
    expect(
      displayName(
        { ...item({ startTime: "10:00", eventSlug: "ghost" }), eventName: null },
        new Map(),
      ),
    ).toBe("(brak nazwy)");
  });
});

describe("buildDayProgram — single lane", () => {
  it("places items in the first lane, hourly rows", () => {
    const prog = buildDayProgram(DAY, [], [item({ startTime: "18:00" })], NO_EVENTS);
    expect(prog.slots).toHaveLength(5);
    expect(prog.lanes).toHaveLength(1);
    expect(prog.lanes[0]!.laneName).toBe("Główna"); // synthetic lane
    expect(prog.lanes[0]!.cells["18:00"]).toMatchObject({ span: 1 });
    expect(prog.strays).toEqual([]);
  });

  it("rowSpans multi-hour events", () => {
    const prog = buildDayProgram(
      DAY,
      [],
      [item({ startTime: "18:00", durationHours: 2 })],
      NO_EVENTS
    );
    expect(prog.lanes[0]!.cells["18:00"]!.span).toBe(2);
  });

  it("caps span at the day's last slot", () => {
    const prog = buildDayProgram(
      DAY,
      [],
      [item({ startTime: "21:00", durationHours: 3 })],
      NO_EVENTS
    );
    // Slots 17..21 (5 slots); starting at 21:00 only 1 slot remains.
    expect(prog.lanes[0]!.cells["21:00"]!.span).toBe(1);
  });
});

describe("buildDayProgram — multi lane", () => {
  const lanes = [LANE_A, LANE_B];

  it("fills each lane column independently", () => {
    const prog = buildDayProgram(
      DAY,
      lanes,
      [
        item({ startTime: "17:00", laneId: "lane-a" }),
        item({ startTime: "17:00", laneId: "lane-b", eventSlug: "quiz" }),
      ],
      NO_EVENTS,
    );
    expect(prog.lanes[0]!.cells["17:00"]).toBeDefined();
    expect(prog.lanes[1]!.cells["17:00"]).toBeDefined();
  });

  it("same slot in different lanes is NOT a collision", () => {
    const prog = buildDayProgram(
      DAY,
      lanes,
      [
        item({ startTime: "18:00", laneId: "lane-a" }),
        item({ startTime: "18:00", laneId: "lane-b" }),
      ],
      NO_EVENTS,
    );
    expect(prog.strays).toEqual([]);
  });

  it("collision within a lane: keeps first, pushes second to strays", () => {
    const prog = buildDayProgram(
      DAY,
      lanes,
      [
        item({ startTime: "18:00", laneId: "lane-a", customName: "Pierwsze" }),
        item({ startTime: "18:00", laneId: "lane-a", customName: "Drugie" }),
      ],
      NO_EVENTS,
    );
    expect(prog.lanes[0]!.cells["18:00"]!.name).toBe("Pierwsze");
    expect(prog.strays).toHaveLength(1);
    expect(prog.strays[0]).toMatchObject({ name: "Drugie", laneName: "Sala A" });
  });

  it("unknown laneId falls back to first lane", () => {
    const prog = buildDayProgram(DAY, lanes, [item({ startTime: "19:00", laneId: "lane-x" })], NO_EVENTS);
    expect(prog.lanes[0]!.cells["19:00"]).toBeDefined();
  });

  it("off-grid start time goes to strays", () => {
    const prog = buildDayProgram(DAY, lanes, [item({ startTime: "09:00" })], NO_EVENTS);
    expect(prog.lanes[0]!.cells["09:00"]).toBeUndefined();
    expect(prog.strays).toHaveLength(1);
  });
});

describe("buildPrograms", () => {
  it("creates one program per day", () => {
    const days: ConventDay[] = [
      { date: "2026-08-21", startTime: "17:00", endTime: "22:00" },
      { date: "2026-08-22", startTime: "10:00", endTime: "16:00" },
    ];
    const progs = buildPrograms(days, [], [item({ startTime: "10:00", date: "2026-08-22" })], []);
    expect(progs).toHaveLength(2);
    expect(progs[0]!.date).toBe("2026-08-21");
    expect(progs[1]!.slots[0]).toBe("10:00");
    // Day 1 has no items; day 2 has one placed.
    expect(Object.keys(progs[0]!.lanes[0]!.cells)).toHaveLength(0);
    expect(Object.keys(progs[1]!.lanes[0]!.cells)).toHaveLength(1);
  });

  it("ignores items from other days", () => {
    const prog = buildDayProgram(
      DAY,
      [],
      [item({ startTime: "17:00", date: "2026-08-22" })],
      NO_EVENTS
    );
    expect(Object.keys(prog.lanes[0]!.cells)).toHaveLength(0);
  });
});

describe("isPast / warsawToday", () => {
  it("warsawToday returns YYYY-MM-DD", () => {
    expect(warsawToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("classifies past vs future strictly by endDate", () => {
    expect(isPast("2001-01-01")).toBe(true);
    expect(isPast("2999-12-31")).toBe(false);
  });
});

describe("date formatting", () => {
  it("formatFullDate", () => {
    expect(formatFullDate("2026-08-21")).toBe("21 sierpnia 2026");
    expect(formatFullDate("2026-01-01")).toBe("1 stycznia 2026");
  });
  it("formatWeekday is UTC-stable", () => {
    // 2026-08-21 is a Friday.
    expect(formatWeekday("2026-08-21")).toBe("piątek");
  });
  it("formatDateRange same day", () => {
    expect(formatDateRange("2026-08-21", "2026-08-21")).toBe("21 sierpnia 2026");
  });
  it("formatDateRange same month", () => {
    expect(formatDateRange("2026-08-21", "2026-08-23")).toBe("21–23 sierpnia 2026");
  });
  it("formatDateRange cross month", () => {
    expect(formatDateRange("2026-08-30", "2026-09-01")).toBe(
      "30 sierpnia – 1 września 2026",
    );
  });
  it("formatDateRange cross year", () => {
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe(
      "30 grudnia 2026 – 2 stycznia 2027",
    );
  });
});