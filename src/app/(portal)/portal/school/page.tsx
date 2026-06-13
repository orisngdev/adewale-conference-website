import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatTile,
  StatusBadge,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Edition, Rep, RegistrationWithRelations } from "@/supabase/types";
import { sanityFetch } from "@/sanity/lib/live";
import { resultsBySchoolsQuery } from "@/sanity/lib/queries";
import type { ResultRow } from "@/sanity/types";
import ClaimForm from "@/components/portal/claim-form";
import RegisterEditionForm from "@/components/portal/register-edition-form";
import AddStudentForm from "@/components/portal/add-student-form";
import { EditionStages, nextStage } from "@/components/portal/edition-stages";
import { PortalResults } from "@/components/portal/portal-results";
import { Notifications } from "@/components/portal/notifications";
import { updateReps } from "./actions";

export const metadata = pageMetadata(
  "School dashboard",
  "Manage your school's reps, registration, and results.",
);
export const dynamic = "force-dynamic";

export default async function SchoolDashboard() {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  // RLS returns registrations the user owns OR that belong to a school they're an
  // approved member of — so a coordinator sees the school's full history.
  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, reps, schools(name, lga), certificates(id, type, asset_url)",
    )
    .order("edition_year", { ascending: false });

  const registrations = (regData ?? []) as unknown as RegistrationWithRelations[];

  // Memberships (own rows, by RLS) — to surface a "pending approval" notice.
  const { data: memberData } = await supabase
    .from("school_members")
    .select("status, schools(name)");
  const pendingMemberships = (
    (memberData ?? []) as unknown as {
      status: string;
      schools: { name: string | null } | null;
    }[]
  ).filter((m) => m.status === "pending");
  const schoolNames = [
    ...new Set(
      registrations.map((r) => r.schools?.name).filter(Boolean) as string[],
    ),
  ];
  const schoolName = schoolNames[0] ?? null;
  const totalReps = registrations.reduce(
    (n, r) => n + (Array.isArray(r.reps) ? (r.reps as Rep[]).length : 0),
    0,
  );

  const { data: resultData } = schoolNames.length
    ? await sanityFetch({
        query: resultsBySchoolsQuery,
        params: { schools: schoolNames },
      })
    : { data: [] };
  const results = (resultData ?? []) as ResultRow[];

  const { data: editionData } = await supabase
    .from("editions")
    .select("year, title, registration_open, stages, current_stage")
    .order("year", { ascending: false });
  const editions = (editionData ?? []) as Edition[];
  const latest = editions[0] ?? null;
  const openEdition = editions.find((e) => e.registration_open) ?? null;
  const registeredYears = new Set(registrations.map((r) => r.edition_year));

  // Students of this school (RLS returns only the coordinator's school).
  const { data: studentData } = await supabase
    .from("students")
    .select("id, name, level, access_code, auth_user_id")
    .order("created_at", { ascending: true });
  const students = (studentData ?? []) as {
    id: string;
    name: string;
    level: string | null;
    access_code: string;
    auth_user_id: string | null;
  }[];

  // Their quiz attempts (RLS scopes to this school's students).
  const { data: attemptData } = await supabase
    .from("quiz_attempts")
    .select("student_user_id, score, total, violations, quizzes(title)")
    .order("created_at", { ascending: false });
  const attempts = (attemptData ?? []) as unknown as {
    student_user_id: string;
    score: number;
    total: number;
    violations: number;
    quizzes: { title: string | null } | null;
  }[];

  const studentsWithAttempts = students
    .map((s) => {
      const best = new Map<
        string,
        { title: string; score: number; total: number; violations: number }
      >();
      for (const a of attempts) {
        if (a.student_user_id !== s.auth_user_id) continue;
        const title = a.quizzes?.title ?? "Quiz";
        const cur = best.get(title);
        if (!cur || a.score > cur.score)
          best.set(title, {
            title,
            score: a.score,
            total: a.total,
            violations: a.violations ?? 0,
          });
      }
      return { id: s.id, name: s.name, best: [...best.values()] };
    })
    .filter((s) => s.best.length > 0);

  return (
    <>
      <PortalHeader
        title={schoolName ?? "Your school"}
        subtitle="Manage your representatives and track results"
      />
      <PortalBody>
        <Notifications />

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Registrations" value={registrations.length} />
          <StatTile label="Representatives" value={totalReps} />
          <StatTile label="Results" value={results.length} />
          <StatTile
            label="Latest status"
            value={registrations[0]?.status ?? "—"}
          />
        </div>

        {pendingMemberships.length > 0 ? (
          <Card className="p-5 md:p-6 border-l-4 border-l-[#E8A020]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A020] mb-1">
              Awaiting approval
            </p>
            <p className="text-sm text-[#4A4E5C]">
              Your access to{" "}
              <span className="font-medium text-[#0A0F1E]">
                {pendingMemberships
                  .map((m) => m.schools?.name)
                  .filter(Boolean)
                  .join(", ") || "your school"}
              </span>{" "}
              is pending an administrator&apos;s approval. You&apos;ll see the
              school&apos;s registrations here once it&apos;s approved.
            </p>
          </Card>
        ) : null}

        {latest ? (
          <div>
            <SectionHeading>{latest.year} edition</SectionHeading>
            <Card className="p-5 md:p-6 space-y-3">
              <EditionStages stages={latest.stages} current={latest.current_stage} />
              <p className="text-sm text-[#4A4E5C]">
                Current stage:{" "}
                <span className="font-medium text-[#0A0F1E]">
                  {latest.current_stage}
                </span>
                {nextStage(latest.stages, latest.current_stage) ? (
                  <> · Next: {nextStage(latest.stages, latest.current_stage)}</>
                ) : null}
              </p>
            </Card>
          </div>
        ) : null}

        {openEdition && !registeredYears.has(openEdition.year) ? (
          <div>
            <SectionHeading>Register for {openEdition.year}</SectionHeading>
            <Card className="p-5 md:p-6">
              <p className="serif-display italic text-[#4A4E5C] mb-4">
                Registration is open — enter your school and representatives to
                join the {openEdition.year} edition.
              </p>
              <RegisterEditionForm year={openEdition.year} />
            </Card>
          </div>
        ) : null}

        {registrations.length === 0 ? (
          <div>
            <SectionHeading>Link a public registration</SectionHeading>
            <Card className="p-5 md:p-6">
              <p className="serif-display italic text-[#4A4E5C] mb-4">
                Registered through the public form on the website? Enter the claim
                code from your confirmation email to link it to this account.
              </p>
              <ClaimForm />
            </Card>
          </div>
        ) : null}

        <div>
          <SectionHeading>Registrations &amp; representatives</SectionHeading>
          {registrations.length === 0 ? (
            <>
              <EmptyState title="No registration yet">
                Your school&apos;s registration will appear here once it&apos;s
                submitted.
              </EmptyState>
              <div className="mt-4 text-center">
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
                      <span className="font-bebas text-2xl text-[#0A0F1E]">
                        {r.edition_year} edition
                      </span>
                      <StatusBadge status={r.status} />
                    </div>

                    {reps.length === 0 ? (
                      <p className="text-sm text-[#4A4E5C]">
                        No representatives on this registration.
                      </p>
                    ) : (
                      <form
                        action={updateReps.bind(null, r.id)}
                        className="space-y-2"
                      >
                        <input type="hidden" name="count" value={reps.length} />
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#4A4E5C]">
                          Representatives
                        </p>
                        {reps.map((rep, i) => (
                          <div key={i} className="flex flex-col sm:flex-row gap-2">
                            <input
                              name={`rep${i}_name`}
                              defaultValue={rep.name}
                              placeholder="Representative name"
                              className="flex-1 rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                            />
                            <input
                              name={`rep${i}_level`}
                              defaultValue={rep.level ?? ""}
                              placeholder="Class (e.g. SS2)"
                              className="sm:w-40 rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                            />
                          </div>
                        ))}
                        <div>
                          <Button type="submit" size="sm" variant="outline">
                            Save changes
                          </Button>
                        </div>
                      </form>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {registrations.length > 0 ? (
          <div>
            <SectionHeading>Students</SectionHeading>
            <Card className="p-5 md:p-6 space-y-4">
              <p className="serif-display italic text-[#4A4E5C]">
                Add your students and share each access code — they sign in to the
                portal with just the code (no email needed).
              </p>
              {students.length > 0 ? (
                <div className="divide-y divide-[#0A0F1E]/5 border border-[#0A0F1E]/10">
                  {students.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between gap-4 p-3"
                    >
                      <span className="text-[#0A0F1E]">
                        {s.name}
                        {s.level ? (
                          <span className="text-[#4A4E5C]"> · {s.level}</span>
                        ) : null}
                      </span>
                      <span className="font-mono font-bold tracking-wider text-[#0A0F1E] bg-[rgba(232,160,32,0.14)] px-2.5 py-1 text-sm">
                        {s.access_code}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              <AddStudentForm />
            </Card>
          </div>
        ) : null}

        {registrations.length > 0 ? (
          <div>
            <SectionHeading>Quiz results</SectionHeading>
            {studentsWithAttempts.length === 0 ? (
              <p className="serif-display italic text-[#4A4E5C]">
                Your students&apos; quiz scores will appear here once they take a
                quiz.
              </p>
            ) : (
              <Card className="divide-y divide-[#0A0F1E]/5">
                {studentsWithAttempts.map((s) => (
                  <div key={s.id} className="p-4">
                    <p className="font-medium text-[#0A0F1E]">{s.name}</p>
                    <ul className="text-sm text-[#4A4E5C] mt-1 space-y-0.5">
                      {s.best.map((b, i) => (
                        <li key={i}>
                          {b.title} —{" "}
                          <span className="text-[#0A0F1E] font-medium">
                            {b.score}/{b.total}
                          </span>
                          {b.violations > 0 ? (
                            <span className="ml-2 text-red-600">
                              ⚠ {b.violations} tab-switch
                              {b.violations === 1 ? "" : "es"}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card>
            )}
          </div>
        ) : null}

        <div>
          <SectionHeading action={{ href: "/results", label: "Hall of Fame →" }}>
            School results
          </SectionHeading>
          <PortalResults results={results} />
        </div>

        <div>
          <SectionHeading action={{ href: "/resources", label: "Open hub →" }}>
            Materials
          </SectionHeading>
          <p className="serif-display italic text-[#4A4E5C]">
            Preparation materials and past questions live in the Resources hub.
          </p>
        </div>
      </PortalBody>
    </>
  );
}
