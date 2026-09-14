import type { DayProgram } from "@/lib/program";
import { formatWeekday, formatFullDate, isSlotCovered } from "@/lib/program";

/**
 * Program grid for one convent: a section per day.
 * - Single lane  → 2 columns (Godzina | Atrakcja)
 * - Multi lane   → 1 column per lane, rows = hours
 * - rowSpan for multi-hour events; strays rendered as a footnote.
 * Panelists are deliberately never displayed.
 */

function TableForDay({ program, accent }: { program: DayProgram; accent: "rose" | "ink" }) {
  const headerBg = accent === "rose" ? "bg-rose text-paper" : "bg-ink text-paper";
  const headerShadow = accent === "rose" ? "shadow-stamp" : "shadow-stamp-mint";

  return (
    <div className="mb-8 last:mb-0">
      <h4 className="font-display text-xs md:text-sm font-extrabold uppercase tracking-[0.18em] text-ink/80 mb-3">
        {formatWeekday(program.date)}, {formatFullDate(program.date)}
      </h4>
      <div className={`overflow-x-auto bg-paper border-[2px] border-ink ${headerShadow}`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th
                scope="col"
                className={`${headerBg} font-display text-[10px] md:text-xs uppercase tracking-[0.18em] px-3 py-2 md:px-4 border-b-[2px] border-ink w-[12ex] whitespace-nowrap`}
              >
                Godzina
              </th>
              {program.lanes.map((lane) => (
                <th
                  key={lane.laneId}
                  scope="col"
                  className={`${headerBg} font-display text-[10px] md:text-xs uppercase tracking-[0.18em] px-3 py-2 md:px-4 border-b-[2px] border-ink border-l-[2px] border-l-ink/40`}
                >
                  {lane.laneName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {program.slots.map((slot, slotIdx) => (
              <tr key={slot} className="even:bg-sky/20">
                <td className="px-3 py-2 md:px-4 font-display text-xs md:text-sm font-bold text-ink border-b border-ink/20 align-top whitespace-nowrap">
                  {slot}
                </td>
                {program.lanes.map((lane) => {
                  const cell = lane.cells[slot];
                  if (cell) {
                    return (
                      <td
                        key={lane.laneId}
                        rowSpan={cell.span > 1 ? cell.span : undefined}
                        className="px-3 py-2 md:px-4 text-sm md:text-base text-ink border-b border-ink/20 border-l-[2px] border-l-ink/10 align-top"
                      >
                        {cell.name}
                      </td>
                    );
                  }
                  // Covered by a rowSpan from above → emit nothing (the
                  // spanning cell already occupies this grid position);
                  // every other empty slot gets an empty cell.
                  if (isSlotCovered(lane, program.slots, slotIdx)) {
                    return null;
                  }
                  return (
                    <td
                      key={lane.laneId}
                      className="border-b border-ink/20 border-l-[2px] border-l-ink/10"
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProgramTable({
  programs,
  accent,
}: {
  programs: DayProgram[];
  accent: "rose" | "ink";
}) {
  const hasAnyItem = programs.some(
    (p) => p.lanes.some((l) => Object.keys(l.cells).length > 0) || p.strays.length > 0,
  );
  if (!hasAnyItem) {
    return (
      <p className="font-accent italic text-lg text-ink/70">
        Program wkrótce.
      </p>
    );
  }

  const allStrays = programs.flatMap((p) => p.strays);

  return (
    <div>
      {programs.map((p) => (
        <TableForDay key={p.date} program={p} accent={accent} />
      ))}
      {allStraysNote(allStrays)}
    </div>
  );
}

type StrayEntry = DayProgram["strays"][number];

function allStraysNote(strays: StrayEntry[]) {
  if (strays.length === 0) return null;
  return (
    <p className="mt-4 text-xs md:text-sm text-ink/70 leading-snug">
      <span className="font-display font-extrabold uppercase tracking-[0.14em] text-[10px] md:text-xs">
        Pozostałe:{" "}
      </span>
      {strays.map((s, i) => (
        <span key={i}>
          {i > 0 && "; "}
          <span className="font-semibold">{s.startTime}</span> {s.name}
          <span className="text-ink/50"> ({s.laneName})</span>
        </span>
      ))}
    </p>
  );
}