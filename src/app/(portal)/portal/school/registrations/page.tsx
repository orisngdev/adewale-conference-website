import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import EmptyState from "@/components/ui/empty-state";
import { Card, SectionHeading, StatusBadge } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Rep, RegistrationWithRelations } from "@/supabase/types";
import { updateReps } from "../actions";

export const metadata = pageMetadata("Registrations", "Your school's registrations and representatives.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export default async function SchoolRegistrations() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const [{ data }, { data: editionData }] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, edition_year, status, reps, schools(name)")
      .order("edition_year", { ascending: false }),
    supabase.from("editions").select("year, registration_open"),
  ]);
  const registrations = (data ?? []) as unknown as RegistrationWithRelations[];
  const openYears = new Set(
    ((editionData ?? []) as { year: number; registration_open: boolean }[])
      .filter((e) => e.registration_open)
      .map((e) => e.year),
  );

  return (
    <div>
      <SectionHeading>Registrations &amp; representatives</SectionHeading>
      {registrations.length === 0 ? (
        <>
          <EmptyState title="No registration yet">
            Your school&apos;s registrations across editions will appear here.
          </EmptyState>
          <div className="mt-4">
            <Button asChild>
              <Link href="/#register">Register a school</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          {registrations.map((r) => {
            const reps = Array.isArray(r.reps) ? (r.reps as Rep[]) : [];
            return (
              <Card key={r.id} className="p-5 md:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bebas text-2xl text-foreground">
                    {r.edition_year} edition
                  </span>
                  <StatusBadge status={r.status} />
                </div>

                {reps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No representatives on this registration.
                  </p>
                ) : openYears.has(r.edition_year) ? (
                  <form action={updateReps.bind(null, r.id)} className="space-y-2">
                    <input type="hidden" name="count" value={reps.length} />
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Representatives
                    </p>
                    {reps.map((rep, i) => (
                      <div key={i} className="flex flex-col sm:flex-row gap-2">
                        <input
                          name={`rep${i}_name`}
                          defaultValue={rep.name}
                          placeholder="Representative name"
                          className={`flex-1 ${inputCls}`}
                        />
                        <input
                          name={`rep${i}_level`}
                          defaultValue={rep.level ?? ""}
                          placeholder="Class (e.g. SS2)"
                          className={`sm:w-40 ${inputCls}`}
                        />
                      </div>
                    ))}
                    <div>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="outline"
                        title="Save representative changes?"
                        description="Updates the names and classes on this registration."
                        confirmLabel="Yes, save"
                      >
                        Save changes
                      </ConfirmSubmitButton>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Representatives · locked (registration closed)
                    </p>
                    {reps.map((rep, i) => (
                      <p key={i} className="text-sm text-foreground">
                        {rep.name}
                        {rep.level ? (
                          <span className="text-muted-foreground"> · {rep.level}</span>
                        ) : null}
                      </p>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
