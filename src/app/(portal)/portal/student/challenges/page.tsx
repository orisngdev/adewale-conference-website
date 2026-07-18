import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { ChallengeChip, ChallengeTypeBadge } from "@/components/portal/challenge-ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import {
  challengeSummary,
  deadlineInfo,
  entryStatusChip,
  type ChallengeType,
} from "@/lib/challenges";

export const metadata = pageMetadata("Challenges", "Compete for the edition.");
export const dynamic = "force-dynamic";

type ChallengeRow = {
  id: string;
  title: string;
  type: ChallengeType;
  metric: string | null;
  description_md: string | null;
  deadline: string | null;
};

export default async function Challenges() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data } = await supabase
    .from("challenges")
    .select("id, title, type, metric, description_md, deadline")
    .eq("published", true)
    .order("created_at", { ascending: false });
  const challenges = (data ?? []) as ChallengeRow[];

  const [{ data: entryData }, { data: subData }] = await Promise.all([
    supabase
      .from("challenge_entries")
      .select("challenge_id, status, score")
      .eq("student_user_id", user.id),
    supabase
      .from("challenge_submissions")
      .select("challenge_id")
      .eq("student_user_id", user.id),
  ]);
  const entryByChallenge = new Map(
    ((entryData ?? []) as { challenge_id: string; status: string; score: number | null }[]).map(
      (e) => [e.challenge_id, e],
    ),
  );
  const dataEntered = new Set(
    ((subData ?? []) as { challenge_id: string }[]).map((s) => s.challenge_id),
  );

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Challenges</SectionHeading>
        <p className="serif-display italic text-muted-foreground">
          Compete for the edition — pick a challenge, submit before it closes.
        </p>
      </div>

      {challenges.length === 0 ? (
        <EmptyState title="No challenges are open yet — check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => {
            const dl = deadlineInfo(c.deadline);
            const entry = entryByChallenge.get(c.id) ?? null;
            const chip = entryStatusChip(
              c.type === "data" ? null : entry,
              c.type === "data" && dataEntered.has(c.id),
            );
            const summary = challengeSummary(c.description_md);
            const cta = entry?.status === "reviewed" ? "See feedback →" : entry ? "Open →" : "Enter →";
            return (
              <Link key={c.id} href={`/portal/student/challenges/${c.id}`} className="block group">
                <Card interactive className="flex h-full flex-col gap-2.5 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <ChallengeTypeBadge
                      type={c.type}
                      suffix={c.type === "data" ? c.metric?.toUpperCase() : null}
                    />
                    <ChallengeChip label={chip.label} tone={chip.tone} />
                  </div>
                  <h4 className="font-bebas text-xl leading-tight text-foreground">{c.title}</h4>
                  {summary ? (
                    <p className="flex-1 text-sm text-muted-foreground">{summary}</p>
                  ) : (
                    <span className="flex-1" />
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-foreground/5 pt-3">
                    <span
                      className={`text-xs tabular-nums ${
                        dl.soon ? "font-semibold text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {dl.label}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">
                      {cta}
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
