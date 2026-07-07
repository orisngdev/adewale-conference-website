import { Card } from "@/components/portal/ui";
import type { ResultRow } from "@/sanity/types";

function rankColor(position?: string): string {
  const p = (position ?? "").toLowerCase();
  if (/1st|first|champion|winner/.test(p) || p.startsWith("1")) return "#E8A020";
  if (/2nd|second|runner/.test(p) || p.startsWith("2")) return "#9CA3AF";
  if (/3rd|third/.test(p) || p.startsWith("3")) return "#B45309";
  return "#0A0F1E";
}

// Results grouped by edition year. `highlightName` shades rows where that
// student's name appears (used on the student dashboard).
export function PortalResults({
  results,
  highlightName,
}: {
  results: ResultRow[];
  highlightName?: string | null;
}) {
  if (results.length === 0) {
    return (
      <p className="serif-display italic text-muted-foreground">
        No results published yet.
      </p>
    );
  }

  const byYear = new Map<number, ResultRow[]>();
  for (const r of results) {
    const y = r.year ?? 0;
    byYear.set(y, [...(byYear.get(y) ?? []), r]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const hl = highlightName?.toLowerCase();

  return (
    <div className="space-y-6">
      {years.map((year) => (
        <div key={year}>
          <h4 className="font-bebas text-xl text-foreground mb-2">
            {year || "—"}
          </h4>
          <Card className="divide-y divide-foreground/5">
            {byYear.get(year)!.map((r) => {
              const mine =
                hl && r.studentNames?.some((n) => n.toLowerCase() === hl);
              return (
                <div
                  key={r._id}
                  className={`flex items-center justify-between gap-4 p-4 ${
                    mine ? "bg-primary/[0.07]" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium text-foreground">
                        {r.category}
                      </span>
                      {r.schoolName ? (
                        <span className="text-sm text-muted-foreground">
                          · {r.schoolName}
                        </span>
                      ) : null}
                    </div>
                    {r.studentNames?.length ? (
                      <p className="text-sm text-muted-foreground">
                        {r.studentNames.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {r.position ? (
                    <span
                      className="font-bebas text-lg shrink-0"
                      style={{ color: rankColor(r.position) }}
                    >
                      {r.position}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </Card>
        </div>
      ))}
    </div>
  );
}
