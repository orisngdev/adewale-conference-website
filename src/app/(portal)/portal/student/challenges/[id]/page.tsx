import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading, StatTile } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import ChallengeSubmit from "@/components/portal/challenge-submit";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

type Challenge = {
  id: string;
  title: string;
  description_md: string | null;
  metric: string;
  id_column: string;
  target_column: string;
  train_url: string | null;
  test_url: string | null;
  deadline: string | null;
  daily_limit: number | null;
};
type LbRow = { name: string; school: string | null; score: number; entries: number };

export default async function ChallengeDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select("id, title, description_md, metric, id_column, target_column, train_url, test_url, deadline, daily_limit")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (!challenge) notFound();
  const c = challenge as Challenge;
  const lowerIsBetter = c.metric === "rmse" || c.metric === "mae";

  const [{ data: lbData }, { data: subData }] = await Promise.all([
    supabase.rpc("get_challenge_leaderboard", { p_challenge_id: id }),
    supabase
      .from("challenge_submissions")
      .select("public_score, created_at")
      .eq("challenge_id", id)
      .eq("student_user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);
  const leaderboard = (lbData ?? []) as LbRow[];
  const subs = (subData ?? []) as { public_score: number | null; created_at: string }[];
  const scores = subs.map((s) => s.public_score).filter((x): x is number => x != null);
  const best = scores.length ? (lowerIsBetter ? Math.min(...scores) : Math.max(...scores)) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/portal/student/challenges"
        className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
      >
        ← All challenges
      </Link>

      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          {c.metric} · {lowerIsBetter ? "lower is better" : "higher is better"}
        </span>
        <h2 className="font-bebas text-3xl text-foreground leading-tight">{c.title}</h2>
        {c.description_md ? (
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed whitespace-pre-line">
            {c.description_md}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatTile label="Your best" value={best != null ? best : "—"} />
        <StatTile label="Your entries" value={subs.length} />
        <StatTile label="On the board" value={leaderboard.length} />
        <StatTile label="Daily limit" value={c.daily_limit ?? "—"} />
      </div>

      <div>
        <SectionHeading>The data</SectionHeading>
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            {c.train_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={c.train_url} download>Download train.csv</a>
              </Button>
            ) : null}
            {c.test_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={c.test_url} download>Download test.csv</a>
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            <span className="font-mono text-foreground">train.csv</span> has the answers;{" "}
            <span className="font-mono text-foreground">test.csv</span> doesn&apos;t. Predict the test
            rows, then upload below.
          </p>
        </Card>
      </div>

      <div>
        <SectionHeading>Submit</SectionHeading>
        <Card className="p-5">
          <ChallengeSubmit challengeId={c.id} idColumn={c.id_column} targetColumn={c.target_column} />
        </Card>
      </div>

      <div>
        <SectionHeading>Leaderboard</SectionHeading>
        {leaderboard.length === 0 ? (
          <EmptyState title="No entries yet — be the first on the board." />
        ) : (
          <Card className="divide-y divide-foreground/5">
            {leaderboard.map((r, i) => (
              <div key={`${r.name}-${i}`} className="flex items-center justify-between gap-3 p-3">
                <span className="flex items-center gap-3 min-w-0">
                  <span className="font-bebas text-lg text-foreground w-6 shrink-0">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="text-foreground block truncate">{r.name}</span>
                    {r.school ? (
                      <span className="text-xs text-muted-foreground block truncate">{r.school}</span>
                    ) : null}
                  </span>
                </span>
                <span className="font-bebas text-lg text-foreground shrink-0 tabular-nums">{r.score}</span>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
