import { redirect } from "next/navigation";
import { Card, SectionHeading, StatTile } from "@/components/portal/ui";
import { EditionStages, nextStage } from "@/components/portal/edition-stages";
import { Notifications } from "@/components/portal/notifications";
import ClaimForm from "@/components/portal/claim-form";
import RegisterEditionForm from "@/components/portal/register-edition-form";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Edition, Rep, RegistrationWithRelations } from "@/supabase/types";

export const metadata = pageMetadata("School dashboard", "Your school overview.");
export const dynamic = "force-dynamic";

export default async function SchoolOverview() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const [{ data: regData }, { data: memberData }, { data: editionData }] = await Promise.all([
    supabase
      .from("registrations")
      .select("id, edition_year, status, reps, schools(name)")
      .order("edition_year", { ascending: false }),
    supabase.from("school_members").select("status, schools(name)"),
    supabase
      .from("editions")
      .select("year, title, registration_open, stages, current_stage")
      .order("year", { ascending: false }),
  ]);
  const registrations = (regData ?? []) as unknown as RegistrationWithRelations[];
  const totalReps = registrations.reduce(
    (n, r) => n + (Array.isArray(r.reps) ? (r.reps as Rep[]).length : 0),
    0,
  );
  const pendingMemberships = (
    (memberData ?? []) as unknown as {
      status: string;
      schools: { name: string | null } | null;
    }[]
  ).filter((m) => m.status === "pending");
  const editions = (editionData ?? []) as Edition[];
  const latest = editions[0] ?? null;
  const registeredYears = new Set(registrations.map((r) => r.edition_year));

  return (
    <>
      <Notifications />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        <StatTile label="Registrations" value={registrations.length} />
        <StatTile label="Representatives" value={totalReps} />
        <StatTile label="Latest status" value={registrations[0]?.status ?? "—"} />
      </div>

      {pendingMemberships.length > 0 ? (
        <Card className="p-5 md:p-6 border-l-4 border-l-primary">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary mb-1">
            Awaiting approval
          </p>
          <p className="text-sm text-muted-foreground">
            Your access to{" "}
            <span className="font-medium text-foreground">
              {pendingMemberships
                .map((m) => m.schools?.name)
                .filter(Boolean)
                .join(", ") || "your school"}
            </span>{" "}
            is pending an administrator&apos;s approval.
          </p>
        </Card>
      ) : null}

      {latest ? (
        <div>
          <SectionHeading>{latest.year} edition</SectionHeading>
          <Card className="p-5 md:p-6 space-y-3">
            <EditionStages stages={latest.stages} current={latest.current_stage} />
            <p className="text-sm text-muted-foreground">
              Current stage:{" "}
              <span className="font-medium text-foreground">
                {latest.current_stage}
              </span>
              {nextStage(latest.stages, latest.current_stage) ? (
                <> · Next: {nextStage(latest.stages, latest.current_stage)}</>
              ) : null}
            </p>
          </Card>
        </div>
      ) : null}

      {latest && !registeredYears.has(latest.year) ? (
        <div>
          <SectionHeading>Register your school for {latest.year}</SectionHeading>
          <Card className="p-5 md:p-6">
            {latest.registration_open ? (
              <>
                <p className="serif-display italic text-muted-foreground mb-4">
                  Registration is open — enter your school and representatives to
                  join the {latest.year} edition.
                </p>
                <RegisterEditionForm year={latest.year} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Registration for {latest.year} isn&apos;t open yet. An admin can
                open it in{" "}
                <span className="font-medium text-foreground">Admin → Editions</span>.
              </p>
            )}
          </Card>
        </div>
      ) : null}

      {registrations.length === 0 ? (
        <div>
          <SectionHeading>Link a public registration</SectionHeading>
          <Card className="p-5 md:p-6">
            <p className="serif-display italic text-muted-foreground mb-4">
              Registered through the public form? Enter the claim code from your
              confirmation email to link it to this account.
            </p>
            <ClaimForm />
          </Card>
        </div>
      ) : null}
    </>
  );
}
