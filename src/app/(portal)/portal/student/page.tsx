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
import type { Edition, RegistrationWithRelations } from "@/supabase/types";
import { EditionStages, nextStage } from "@/components/portal/edition-stages";
import { PortalResults } from "@/components/portal/portal-results";
import { Notifications } from "@/components/portal/notifications";
import { sanityFetch } from "@/sanity/lib/live";
import {
  currentEditionQuery,
  resultsBySchoolsQuery,
  resourcesQuery,
} from "@/sanity/lib/queries";
import type { EditionListItem, ResourceListItem, ResultRow } from "@/sanity/types";

export const metadata = pageMetadata(
  "Student dashboard",
  "Your ASC status, schedule, and resources.",
);
export const dynamic = "force-dynamic";

function formatDateRange(start?: string, end?: string) {
  if (!start) return "Dates to be announced";
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  const s = new Date(start).toLocaleDateString("en-GB", opts);
  if (!end) return s;
  return `${s} – ${new Date(end).toLocaleDateString("en-GB", opts)}`;
}

export default async function StudentDashboard() {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, reps, schools(name, lga), certificates(id, type, asset_url)",
    )
    .eq("owner_id", user.id)
    .order("edition_year", { ascending: false });

  const registrations = (regData ?? []) as unknown as RegistrationWithRelations[];
  const certificates = registrations
    .flatMap((r) => r.certificates ?? [])
    .filter((c) => c.asset_url);

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  // Code-provisioned students have a `students` record (no registrations of
  // their own) — use it to greet them and scope results to their school.
  const { data: studentRecord } = await supabase
    .from("students")
    .select("name, schools(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const studentSchool = (
    studentRecord?.schools as unknown as { name: string | null } | null
  )?.name;

  const schoolNames = [
    ...new Set(
      [
        ...registrations.map((r) => r.schools?.name),
        studentSchool,
      ].filter(Boolean) as string[],
    ),
  ];

  const [{ data: editionData }, { data: resourceData }, { data: resultData }] =
    await Promise.all([
      sanityFetch({ query: currentEditionQuery, params: {} }),
      sanityFetch({
        query: resourcesQuery,
        params: { type: "", subject: "", level: "" },
      }),
      schoolNames.length
        ? sanityFetch({
            query: resultsBySchoolsQuery,
            params: { schools: schoolNames },
          })
        : Promise.resolve({ data: [] }),
    ]);
  const currentEdition = (editionData ?? null) as EditionListItem | null;
  const resources = ((resourceData ?? []) as ResourceListItem[]).slice(0, 6);
  const results = (resultData ?? []) as ResultRow[];

  const { data: opsEditionData } = await supabase
    .from("editions")
    .select("year, title, registration_open, stages, current_stage")
    .order("year", { ascending: false });
  const latest = ((opsEditionData ?? []) as Edition[])[0] ?? null;

  // Published quizzes + this student's best score per quiz.
  const [{ data: quizData }, { data: attemptData }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id, title, subject, level")
      .eq("published", true)
      .order("created_at", { ascending: false }),
    supabase.from("quiz_attempts").select("quiz_id, score, total"),
  ]);
  const quizzes = (quizData ?? []) as {
    id: string;
    title: string;
    subject: string | null;
    level: string | null;
  }[];
  const bestByQuiz = new Map<string, { score: number; total: number }>();
  for (const a of (attemptData ?? []) as {
    quiz_id: string;
    score: number;
    total: number;
  }[]) {
    const cur = bestByQuiz.get(a.quiz_id);
    if (!cur || a.score > cur.score)
      bestByQuiz.set(a.quiz_id, { score: a.score, total: a.total });
  }

  return (
    <>
      <PortalHeader
        title="Your dashboard"
        subtitle={
          studentRecord?.name
            ? `${studentRecord.name}${studentSchool ? ` · ${studentSchool}` : ""}`
            : "Track your conference journey"
        }
      />
      <PortalBody>
        <Notifications />

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Registrations" value={registrations.length} />
          <StatTile label="Certificates" value={certificates.length} />
          <StatTile
            label="Current edition"
            value={currentEdition?.year ?? "—"}
          />
          <StatTile
            label="Status"
            value={registrations[0]?.status ?? "—"}
          />
        </div>

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

        <div>
          <SectionHeading>Your registration</SectionHeading>
          {registrations.length === 0 ? (
            <>
              <EmptyState title="Not registered yet">
                Once your school registers you, your status will appear here.
              </EmptyState>
              <div className="mt-4 text-center">
                <Button asChild>
                  <Link href="/#register">Register</Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {registrations.map((r) => (
                <Card key={r.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="font-bebas text-2xl text-[#0A0F1E]">
                      {r.edition_year}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.schools?.name ? (
                    <p className="serif-display italic text-[#4A4E5C] mt-1">
                      {r.schools.name}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>Edition schedule</SectionHeading>
          {currentEdition ? (
            <Card className="p-6">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A020]">
                {currentEdition.status}
              </span>
              <h3 className="font-bebas text-3xl text-[#0A0F1E] mt-1">
                {currentEdition.year} — {currentEdition.theme}
              </h3>
              <p className="serif-display italic text-[#4A4E5C] mt-1">
                {formatDateRange(currentEdition.startDate, currentEdition.endDate)}
              </p>
            </Card>
          ) : (
            <p className="serif-display italic text-[#4A4E5C]">
              No upcoming edition scheduled yet.
            </p>
          )}
        </div>

        <div>
          <SectionHeading action={{ href: "/results", label: "Hall of Fame →" }}>
            Your results
          </SectionHeading>
          <PortalResults results={results} highlightName={profile?.full_name} />
        </div>

        {quizzes.length > 0 ? (
          <div>
            <SectionHeading>Quizzes</SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2">
              {quizzes.map((quiz) => {
                const best = bestByQuiz.get(quiz.id);
                return (
                  <Link
                    key={quiz.id}
                    href={`/portal/student/quiz/${quiz.id}`}
                    className="block group"
                  >
                    <Card className="p-5 h-full group-hover:border-[#E8A020] transition-colors">
                      <h4 className="font-bebas text-xl text-[#0A0F1E]">
                        {quiz.title}
                      </h4>
                      <p className="text-sm text-[#4A4E5C] mt-1">
                        {[quiz.subject, quiz.level].filter(Boolean).join(" · ") ||
                          "Quiz"}
                      </p>
                      <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[#E8A020]">
                        {best
                          ? `Best ${best.score}/${best.total} · Retake →`
                          : "Take quiz →"}
                      </p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}

        <div>
          <SectionHeading action={{ href: "/resources", label: "All resources →" }}>
            Study resources
          </SectionHeading>
          {resources.length === 0 ? (
            <p className="serif-display italic text-[#4A4E5C]">
              Resources will appear here as they&apos;re published.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((res) => (
                <Link
                  key={res._id}
                  href={res.slug ? `/resources/${res.slug}` : "/resources"}
                  className="block group"
                >
                  <Card className="p-5 h-full group-hover:border-[#E8A020] transition-colors">
                    {res.type ? (
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8A020]">
                        {res.type.replace("-", " ")}
                      </span>
                    ) : null}
                    <h4 className="font-bebas text-xl text-[#0A0F1E] mt-1">
                      {res.title}
                    </h4>
                    <p className="text-sm text-[#4A4E5C] mt-1">
                      {[res.subject, res.level].filter(Boolean).join(" · ")}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>Certificates</SectionHeading>
          {certificates.length === 0 ? (
            <p className="serif-display italic text-[#4A4E5C]">
              Certificates you earn will be available to download here.
            </p>
          ) : (
            <div className="space-y-3">
              {certificates.map((c) => (
                <Card
                  key={c.id}
                  className="flex items-center justify-between p-4"
                >
                  <span className="text-[#0A0F1E]">{c.type ?? "Certificate"}</span>
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={c.asset_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PortalBody>
    </>
  );
}
