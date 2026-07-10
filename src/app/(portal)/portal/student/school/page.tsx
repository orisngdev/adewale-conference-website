import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading, StatTile, StatusBadge } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("My school", "Your school and coordinator.");
export const dynamic = "force-dynamic";

type MySchool = {
  school: { id: string; name: string; lga: string | null; category: string | null } | null;
  coordinators: { name: string | null; email: string }[];
  student_count: number;
  registration: { edition_year: number; status: string } | null;
} | null;

export default async function StudentSchool() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data } = await supabase.rpc("get_my_school");
  const info = (data ?? null) as MySchool;

  if (!info?.school) {
    return (
      <div>
        <SectionHeading>My school</SectionHeading>
        <EmptyState title="You're not linked to a school yet.">
          Ask your teacher for a team login code, then link it from your dashboard —
          your school and coordinator will show up here.
        </EmptyState>
      </div>
    );
  }

  const { school, coordinators, student_count, registration } = info;

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>My school</SectionHeading>
        <Card className="p-5 md:p-6 border-l-4 border-l-primary">
          <h3 className="font-bebas text-3xl text-foreground leading-tight">{school.name}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {[school.lga, school.category].filter(Boolean).join(" · ") || "Ogun State"}
          </p>
          {registration ? (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{registration.edition_year} edition</span>
              <StatusBadge status={registration.status} />
            </div>
          ) : null}
        </Card>
      </div>

      <div>
        <SectionHeading>
          {coordinators.length > 1 ? "Your coordinators" : "Your coordinator"}
        </SectionHeading>
        {coordinators.length === 0 ? (
          <EmptyState title="No coordinator on record yet.">
            Your school hasn&apos;t had a coordinator approved for this edition.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {coordinators.map((c) => (
              <Card key={c.email} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{c.name ?? "Coordinator"}</p>
                  <p className="text-sm text-muted-foreground truncate">{c.email}</p>
                </div>
                <a
                  href={`mailto:${c.email}`}
                  className="shrink-0 text-xs uppercase tracking-[0.2em] text-primary hover:underline"
                >
                  Email →
                </a>
              </Card>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-3">
          Your coordinator registers your school, assigns your learning plans, and tracks your results.
        </p>
      </div>

      <div>
        <SectionHeading>At a glance</SectionHeading>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <StatTile label="Students enrolled" value={student_count} />
          <StatTile label="Current edition" value={registration?.edition_year ?? "—"} />
        </div>
      </div>
    </div>
  );
}
