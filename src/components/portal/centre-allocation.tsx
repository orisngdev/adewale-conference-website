import { Card } from "@/components/portal/ui";
import EmptyState from "@/components/ui/empty-state";
import { CentreAllocationForm, type CentreSaveState } from "@/components/portal/centre-allocation-form";
import { CentrePicker } from "@/components/portal/centre-picker";
import { ZONAL_FINALS_OPTIONS } from "@/lib/forms";

// Allocating zonal exam centres for a whole edition.
//
// Schools state a preferred centre on the registration form, and those preferences
// are lopsided — for 2026, 42 schools asked for Abeokuta and 2 for Ayetoro. So the
// job is not "record a choice" but "confirm the requests and move some schools",
// which is a whole-edition operation, not a per-row one.
//
// Every dropdown pre-selects the centre already in play: the existing allocation, or
// the school's own request. Submitting unchanged therefore confirms every request at
// once; changing a few dropdowns first is how you rebalance. Nothing is written until
// the button is pressed.
//
// The load bars and the group headings show where each school WILL sit, not where it
// sits now, because the point of the screen is to review a distribution before
// committing to it. Anything that is not one of the eight centres is labelled as such
// wherever it appears, so a leftover LGA reads as a problem rather than a venue.

export interface CentreRow {
  registrationId: string;
  school: string;
  lga: string | null;
  reps: number;
  /** Confirmed admin allocation, if any — not necessarily a real centre. */
  allocated: string | null;
  /** The school's own answer, but only when it names a real centre. */
  requested: string | null;
  /** The school's own answer exactly as given, however odd. */
  requestedRaw: string | null;
}

const UNASSIGNED = "Unassigned";
function isCentre(value: string | null): value is string {
  return Boolean(value) && (ZONAL_FINALS_OPTIONS as readonly string[]).includes(value as string);
}

/** What "Save all centres" would write for this row if nobody touches it. Grouping by
 *  this — rather than by the stored value — is what keeps the bars, the headings and
 *  the dropdowns telling one story. Kept in step with `preselect` below. */
function pendingCentre(row: CentreRow) {
  if (isCentre(row.allocated)) return row.allocated;
  return row.requested ?? row.allocated ?? UNASSIGNED;
}

/** What the dropdown pre-selects: only ever a real centre, or nothing. A stored value
 *  that is not a centre goes to the text box instead, so it survives an untouched
 *  save rather than being silently cleared. */
function preselect(row: CentreRow) {
  if (isCentre(row.allocated)) return row.allocated;
  return row.requested ?? "";
}

/** The row's one-line status, in the same words used elsewhere in the admin. */
function rowNote(row: CentreRow) {
  if (isCentre(row.allocated)) {
    // An allocation matching the school's own answer is the default nobody has
    // reviewed yet, which is worth telling apart from a decision.
    if (row.allocated === row.requestedRaw) return "as requested";
    return row.requestedRaw ? `moved from ${row.requestedRaw}` : "allocated";
  }
  if (row.allocated && row.requested)
    return `${row.allocated} is not a centre · saving moves this school to ${row.requested}`;
  if (row.allocated) return `${row.allocated} is not a centre`;
  if (row.requested) return "school's request";
  if (row.requestedRaw) return `asked for ${row.requestedRaw} · not a centre`;
  return "no centre chosen";
}

export function CentreAllocation({
  rows,
  canManage,
  action,
}: {
  rows: CentreRow[];
  canManage: boolean;
  action: (state: CentreSaveState, formData: FormData) => Promise<CentreSaveState>;
}) {
  if (rows.length === 0) {
    return <EmptyState title="No schools to allocate">No approved teams for this edition yet.</EmptyState>;
  }

  const groups = new Map<string, CentreRow[]>();
  for (const centre of ZONAL_FINALS_OPTIONS) groups.set(centre, []);
  groups.set(UNASSIGNED, []);
  for (const row of rows) {
    const key = pendingCentre(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const confirmed = rows.filter((r) => isCentre(r.allocated)).length;
  const busiest = Math.max(...[...groups.values()].map((g) => g.length), 1);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-bebas text-2xl leading-none text-foreground">Centre load</p>
          <p className="text-xs text-muted-foreground">
            where these {rows.length} schools would sit if you save now · {confirmed} already
            confirmed
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {[...groups.entries()].map(([centre, list]) => {
            const students = list.reduce((n, r) => n + r.reps, 0);
            const odd = centre !== UNASSIGNED && !isCentre(centre);
            return (
              <div key={centre} className="flex items-center gap-3 text-sm">
                <span
                  className={`w-28 shrink-0 truncate ${
                    centre === UNASSIGNED || odd ? "text-amber-700 dark:text-amber-400" : "text-foreground"
                  }`}
                  title={odd ? `${centre} — not one of the eight centres` : centre}
                >
                  {centre}
                </span>
                {/* Fixed track with an inner fill: a bare percentage-width bar is a
                    flex item, so at full width it squeezes the counts beside it. */}
                <span className="h-2 min-w-0 flex-1 rounded-full bg-foreground/5">
                  <span
                    className="block h-2 min-w-[2px] rounded-full bg-primary/60"
                    style={{ width: `${Math.round((list.length / busiest) * 100)}%` }}
                  />
                </span>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {list.length} school{list.length === 1 ? "" : "s"} · {students} student
                  {students === 1 ? "" : "s"}
                </span>
              </div>
            );
          })}
        </div>
        {/* No seat capacities are recorded anywhere, so this shows the distribution
            rather than pretending to know which centres are over capacity. */}
        <p className="mt-4 text-xs text-muted-foreground">
          Seat capacities are not recorded, so this is the spread of demand rather than a
          measure of over-subscription.
        </p>
      </Card>

      <CentreAllocationForm action={action} canManage={canManage}>
        <div className="space-y-4">
          {[...groups.entries()]
            .filter(([, list]) => list.length > 0)
            .map(([centre, list]) => (
              <Card key={centre} className="divide-y divide-foreground/5">
                <div className="flex items-baseline justify-between gap-2 px-4 py-2">
                  <span className="font-medium text-foreground">
                    {centre}
                    {centre !== UNASSIGNED && !isCentre(centre) ? (
                      <span className="ml-2 text-xs font-normal text-amber-700 dark:text-amber-400">
                        not a centre
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {list.length} school{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                {list.map((row) => (
                  <div
                    key={row.registrationId}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-foreground">{row.school}</span>
                      <p className="text-xs text-muted-foreground">
                        {row.lga ?? "No LGA"} · {row.reps} rep{row.reps === 1 ? "" : "s"} ·{" "}
                        {rowNote(row)}
                      </p>
                    </div>
                    <CentrePicker
                      label={row.school}
                      name={`zone:${row.registrationId}`}
                      otherName={`zoneOther:${row.registrationId}`}
                      defaultValue={preselect(row)}
                      defaultOther={isCentre(row.allocated) ? "" : row.allocated ?? ""}
                      disabled={!canManage}
                    />
                  </div>
                ))}
              </Card>
            ))}
        </div>
      </CentreAllocationForm>
    </div>
  );
}
