import Link from "next/link";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatTile,
} from "@/components/portal/ui";
import { SubmitButton } from "@/components/portal/submit-button";
import { EditionStages, nextStage } from "@/components/portal/edition-stages";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type { Edition, RegistrationStatus } from "@/supabase/types";
import {
  advanceEditionStage,
  createEdition,
  setEditionStage,
  toggleRegistration,
} from "./actions";

export const metadata = pageMetadata("Editions", "Run the conference year by year.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

const ACCEPTED: RegistrationStatus[] = ["verified", "qualified", "finalist"];

export default async function AdminEditions() {
  const supabase = await createClient();
  const [{ data: editionData }, { data: regData }] = await Promise.all([
    supabase
      .from("editions")
      .select("year, title, registration_open, stages, current_stage")
      .order("year", { ascending: false }),
    supabase.from("registrations").select("edition_year, status"),
  ]);
  const editions = (editionData ?? []) as Edition[];
  const regs = (regData ?? []) as { edition_year: number; status: RegistrationStatus }[];
  const statsFor = (year: number) => {
    const rows = regs.filter((r) => r.edition_year === year);
    return {
      total: rows.length,
      review: rows.filter((r) => r.status === "submitted").length,
      accepted: rows.filter((r) => ACCEPTED.includes(r.status)).length,
      declined: rows.filter((r) => r.status === "declined").length,
    };
  };

  const [current, ...past] = editions;

  return (
    <>
      <PortalHeader
        title="Editions"
        subtitle="Registration, stages, and the year's numbers — all in one place"
      />
      <PortalBody>
        {!current ? (
          <p className="serif-display italic text-muted-foreground">
            No editions yet — add the first one below.
          </p>
        ) : (
          <div>
            <SectionHeading action={{ href: "/portal/admin/registrations", label: "Review registrations →" }}>
              Current edition
            </SectionHeading>
            <Card className="p-5 md:p-7 space-y-6 border-l-4 border-l-primary">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="font-bebas text-5xl text-foreground leading-none">
                    {current.year}
                  </span>
                  {current.title ? (
                    <p className="serif-display italic text-muted-foreground mt-1">
                      {current.title}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide ${
                      current.registration_open
                        ? "bg-green-100 text-green-800"
                        : "bg-foreground/5 text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-2 rounded-full ${
                        current.registration_open ? "bg-green-600" : "bg-muted-foreground/50"
                      }`}
                    />
                    {current.registration_open ? "Registration open" : "Registration closed"}
                  </span>
                  <form action={toggleRegistration.bind(null, current.year, !current.registration_open)}>
                    <ConfirmSubmitButton
                      size="sm"
                      variant={current.registration_open ? "outline" : "default"}
                      title={
                        current.registration_open
                          ? `Close ${current.year} registration?`
                          : `Open ${current.year} registration?`
                      }
                      description={
                        current.registration_open
                          ? "New registrations are rejected everywhere, public form included."
                          : "The public form and in-portal registration start accepting schools."
                      }
                      confirmLabel={current.registration_open ? "Yes, close" : "Yes, open"}
                    >
                      {current.registration_open ? "Close registration" : "Open registration"}
                    </ConfirmSubmitButton>
                  </form>
                </div>
              </div>
              <p className="text-sm text-muted-foreground -mt-3">
                {current.registration_open
                  ? "The public form and in-portal registration are accepting schools for this edition."
                  : "New registrations are rejected everywhere (public form included) until you open this."}
              </p>

              {/* The year at a glance — live from the registrations table. */}
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                {(() => {
                  const s = statsFor(current.year);
                  return (
                    <>
                      <StatTile label="Registrations" value={s.total} />
                      <StatTile label="Under review" value={s.review} />
                      <StatTile label="Accepted" value={s.accepted} />
                      <StatTile label="Declined" value={s.declined} />
                    </>
                  );
                })()}
              </div>

              <div className="space-y-3">
                <EditionStages stages={current.stages} current={current.current_stage} />
                <div className="flex flex-wrap items-center gap-2">
                  {nextStage(current.stages, current.current_stage) ? (
                    <form action={advanceEditionStage.bind(null, current.year)}>
                      <ConfirmSubmitButton
                        size="sm"
                        title={`Advance to ${nextStage(current.stages, current.current_stage)}?`}
                        description="Every registered school and student is notified in the portal."
                        confirmLabel="Yes, advance"
                      >
                        Advance to {nextStage(current.stages, current.current_stage)} →
                      </ConfirmSubmitButton>
                    </form>
                  ) : (
                    <span className="text-sm text-muted-foreground">Final stage reached.</span>
                  )}
                  <details className="relative">
                    <summary className="cursor-pointer list-none text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground px-2 py-1.5">
                      Jump to a stage…
                    </summary>
                    <form action={setEditionStage.bind(null, current.year)} className="flex gap-2 mt-2">
                      <select name="stage" defaultValue={current.current_stage} className={inputCls}>
                        {current.stages.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="outline"
                        title="Jump to this stage?"
                        description="Changing the stage notifies every registered school and student in the portal."
                        confirmLabel="Yes, set stage"
                      >
                        Set stage
                      </ConfirmSubmitButton>
                    </form>
                  </details>
                </div>
                <p className="text-xs text-muted-foreground">
                  Advancing a stage notifies every registered school and student in the portal.
                </p>
              </div>
            </Card>
          </div>
        )}

        {past.length > 0 ? (
          <div>
            <SectionHeading>Past editions</SectionHeading>
            <Card className="divide-y divide-foreground/5">
              {past.map((e) => {
                const s = statsFor(e.year);
                return (
                  <details key={e.year} className="p-4 group">
                    <summary className="cursor-pointer list-none flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-bebas text-2xl text-foreground">{e.year}</span>
                        <span className="ml-3 text-sm text-muted-foreground">
                          {e.title ? `${e.title} · ` : ""}
                          {s.total} registration{s.total === 1 ? "" : "s"} · stage: {e.current_stage}
                          {e.registration_open ? " · ⚠ registration still open" : ""}
                        </span>
                      </div>
                      <span className="text-xs uppercase tracking-[0.15em] text-primary group-open:hidden">
                        Manage
                      </span>
                      <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground hidden group-open:inline">
                        Close
                      </span>
                    </summary>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <form action={toggleRegistration.bind(null, e.year, !e.registration_open)}>
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          title={
                            e.registration_open
                              ? `Close ${e.year} registration?`
                              : `Reopen ${e.year} registration?`
                          }
                          description={
                            e.registration_open
                              ? "New registrations for this past edition are rejected everywhere."
                              : "Schools can register for this past edition again, public form included."
                          }
                          confirmLabel={e.registration_open ? "Yes, close" : "Yes, reopen"}
                        >
                          {e.registration_open ? "Close registration" : "Reopen registration"}
                        </ConfirmSubmitButton>
                      </form>
                      <form action={setEditionStage.bind(null, e.year)} className="flex gap-2">
                        <select name="stage" defaultValue={e.current_stage} className={inputCls}>
                          {e.stages.map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          title={`Change the ${e.year} stage?`}
                          description="Changing the stage notifies every registered school and student in the portal."
                          confirmLabel="Yes, set stage"
                        >
                          Set stage
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </details>
                );
              })}
            </Card>
          </div>
        ) : null}

        <div>
          <SectionHeading>Add an edition</SectionHeading>
          <Card className="p-5 md:p-6">
            <form action={createEdition} className="flex flex-col sm:flex-row gap-2">
              <input
                name="year"
                type="number"
                required
                placeholder="Year (e.g. 2027)"
                className={`sm:w-40 ${inputCls}`}
              />
              <input
                name="title"
                placeholder="Theme (optional)"
                className={`flex-1 ${inputCls}`}
              />
              <SubmitButton size="sm" pendingText="Adding…">Add edition</SubmitButton>
            </form>
            <p className="text-xs text-muted-foreground mt-2">
              New editions start closed with the default stages — open registration above when you&apos;re ready.
            </p>
          </Card>
        </div>
      </PortalBody>
    </>
  );
}
