import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading, StatTile } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { Markdown } from "@/components/portal/markdown";
import ChallengeSubmit from "@/components/portal/challenge-submit";
import { BmcSnapshot, ChallengeChip, ChallengeTypeBadge } from "@/components/portal/challenge-ui";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import {
  deadlineInfo,
  isPastDeadline,
  linkFields,
  shortDate,
  textBody,
  type ChallengeEntry,
  type ChallengeType,
} from "@/lib/challenges";
import { submitLinkEntry, submitPitchEntry, submitTextEntry } from "../actions";

export const dynamic = "force-dynamic";

type Challenge = {
  id: string;
  title: string;
  type: ChallengeType;
  description_md: string | null;
  metric: string | null;
  id_column: string;
  target_column: string;
  train_url: string | null;
  test_url: string | null;
  deadline: string | null;
  daily_limit: number | null;
  edition_year: number | null;
};
type LbRow = { name: string; school: string | null; score: number; entries: number };

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

const ERRORS: Record<string, string> = {
  deadline: "The deadline has passed — this challenge is now locked.",
  reviewed: "Your entry has been reviewed and can no longer be changed.",
  closed: "This challenge isn't open for entries.",
  empty: "There's nothing to submit yet — add your work first.",
  url: "Enter a valid link starting with http:// or https://.",
};

export default async function ChallengeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const { e } = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data: challenge } = await supabase
    .from("challenges")
    .select(
      "id, title, type, description_md, metric, id_column, target_column, train_url, test_url, deadline, daily_limit, edition_year",
    )
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();
  if (!challenge) notFound();
  const c = challenge as Challenge;

  if (c.type === "data") return <DataArena c={c} userId={user.id} supabase={supabase} />;

  const { data: entryData } = await supabase
    .from("challenge_entries")
    .select("id, challenge_id, student_user_id, payload, note, submitted_at, status, score, feedback, reviewed_at")
    .eq("challenge_id", id)
    .eq("student_user_id", user.id)
    .maybeSingle();
  const entry = (entryData as ChallengeEntry | null) ?? null;

  const dl = deadlineInfo(c.deadline);
  const closed = isPastDeadline(c.deadline);
  const reviewed = entry?.status === "reviewed";
  const locked = reviewed || closed;
  const error = e ? ERRORS[e] : null;

  return (
    <div className="space-y-6">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        <Link href="/portal/student/challenges" className="hover:underline">
          ← Challenges
        </Link>{" "}
        / <span className="text-gold-ink">{c.title}</span>
      </p>

      {error ? (
        <Card className="border-l-4 border-l-red-500 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr] items-start">
        {/* ── Brief ─────────────────────────────────────────────────────── */}
        <Card className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <ChallengeTypeBadge type={c.type} />
            {entry ? (
              reviewed ? (
                <ChallengeChip label={`Reviewed · ${entry.score ?? "—"}`} tone="green" />
              ) : (
                <ChallengeChip label={`Submitted ${shortDate(entry.submitted_at)}`} tone="gold" />
              )
            ) : (
              <ChallengeChip label="Not entered" tone="grey" />
            )}
          </div>
          <h2 className="mt-2 font-bebas text-3xl leading-tight text-foreground">{c.title}</h2>
          {c.description_md ? (
            <div className="mt-3 max-w-2xl">
              <Markdown source={c.description_md} />
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-foreground/5 pt-4 text-xs text-muted-foreground">
            <span className={dl.soon ? "font-semibold text-red-600" : ""}>{dl.label}</span>
            {c.edition_year ? (
              <span>
                Edition <b className="text-foreground">{c.edition_year}</b>
              </span>
            ) : null}
          </div>
        </Card>

        {/* ── Entry / review ────────────────────────────────────────────── */}
        {reviewed ? (
          <ReviewedPanel entry={entry} />
        ) : (
          <Card className="p-5 md:p-6">
            <h3 className="font-bebas text-lg uppercase tracking-wide text-foreground">Your entry</h3>
            <div className="mt-3">
              {c.type === "pitch" ? (
                <PitchEntry challengeId={c.id} entry={entry} locked={locked} />
              ) : c.type === "text" ? (
                <TextEntry challengeId={c.id} entry={entry} locked={locked} />
              ) : (
                <LinkEntry challengeId={c.id} entry={entry} locked={locked} />
              )}
            </div>
            <p className="mt-4 border-t border-foreground/5 pt-3 text-xs text-muted-foreground">
              {closed
                ? "Entries are locked — the deadline has passed."
                : "You can resubmit until the deadline or once it's reviewed."}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── Reviewed panel (replaces the submit box) ──────────────────────────────────
function ReviewedPanel({ entry }: { entry: ChallengeEntry }) {
  return (
    <Card className="border border-green-600/40 bg-green-600/8 p-5 md:p-6">
      <div className="flex items-baseline gap-3">
        <span className="font-bebas text-4xl leading-none text-green-700">{entry.score ?? "—"}</span>
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          / 100 · Reviewed
        </span>
      </div>
      {entry.feedback ? (
        <p className="mt-3 text-sm text-foreground/90">{entry.feedback}</p>
      ) : (
        <p className="mt-3 text-sm italic text-muted-foreground">No written feedback was left.</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Reviewed {shortDate(entry.reviewed_at)} · your entry is locked.
      </p>
    </Card>
  );
}

// ── Pitch entry ───────────────────────────────────────────────────────────────
function PitchEntry({
  challengeId,
  entry,
  locked,
}: {
  challengeId: string;
  entry: ChallengeEntry | null;
  locked: boolean;
}) {
  return (
    <div className="space-y-3">
      {entry ? (
        <>
          <BmcSnapshot payload={entry.payload} />
          <p className="text-xs text-muted-foreground">
            Snapshot of your canvas from <b className="text-foreground">{shortDate(entry.submitted_at)}</b>.
            Editing in the Pitch Studio won&apos;t change your entry — resubmit to update it.
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Build your Business Model Canvas in the Pitch Studio, then submit a snapshot of it as your
          entry.
        </p>
      )}
      {!locked ? (
        <div className="flex flex-wrap items-center gap-2">
          <form action={submitPitchEntry.bind(null, challengeId)}>
            <SubmitButton size="sm" pendingText="Submitting…">
              {entry ? "Resubmit latest canvas" : "Submit my canvas"}
            </SubmitButton>
          </form>
          <Button asChild size="sm" variant="outline">
            <Link href="/portal/student/pitch-studio">Open Pitch Studio →</Link>
          </Button>
        </div>
      ) : (
        <Button asChild size="sm" variant="outline">
          <Link href="/portal/student/pitch-studio">Open Pitch Studio →</Link>
        </Button>
      )}
    </div>
  );
}

// ── Text (write-up) entry ─────────────────────────────────────────────────────
function TextEntry({
  challengeId,
  entry,
  locked,
}: {
  challengeId: string;
  entry: ChallengeEntry | null;
  locked: boolean;
}) {
  const current = entry ? textBody(entry.payload) : "";
  if (locked) {
    return current ? (
      <p className="whitespace-pre-wrap text-sm text-foreground/90">{current}</p>
    ) : (
      <p className="text-sm italic text-muted-foreground">No response was submitted.</p>
    );
  }
  return (
    <form action={submitTextEntry.bind(null, challengeId)} className="space-y-3">
      <textarea
        name="text"
        required
        rows={10}
        defaultValue={current}
        placeholder="Write your response…"
        className={inputCls}
      />
      <SubmitButton size="sm" pendingText="Submitting…">
        {entry ? "Resubmit response" : "Submit response"}
      </SubmitButton>
    </form>
  );
}

// ── Link entry ────────────────────────────────────────────────────────────────
function LinkEntry({
  challengeId,
  entry,
  locked,
}: {
  challengeId: string;
  entry: ChallengeEntry | null;
  locked: boolean;
}) {
  const { url, label } = entry ? linkFields(entry.payload) : { url: "", label: "" };
  if (locked) {
    return url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-sm text-primary underline underline-offset-2"
      >
        {label || url} ↗
      </a>
    ) : (
      <p className="text-sm italic text-muted-foreground">No link was submitted.</p>
    );
  }
  return (
    <form action={submitLinkEntry.bind(null, challengeId)} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Link</span>
        <input name="url" type="url" required defaultValue={url} placeholder="https://…" className={inputCls} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Label (optional)
        </span>
        <input name="label" defaultValue={label} placeholder="e.g. My 60-second pitch on YouTube" className={inputCls} />
      </label>
      <SubmitButton size="sm" pendingText="Submitting…">
        {entry ? "Resubmit link" : "Submit link"}
      </SubmitButton>
    </form>
  );
}

// ── Data arena (unchanged from the original detail page) ──────────────────────
async function DataArena({
  c,
  userId,
  supabase,
}: {
  c: Challenge;
  userId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const lowerIsBetter = c.metric === "rmse" || c.metric === "mae";

  const [{ data: lbData }, { data: subData }] = await Promise.all([
    supabase.rpc("get_challenge_leaderboard", { p_challenge_id: c.id }),
    supabase
      .from("challenge_submissions")
      .select("public_score, created_at")
      .eq("challenge_id", c.id)
      .eq("student_user_id", userId)
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
                <a href={c.train_url} download>
                  Download train.csv
                </a>
              </Button>
            ) : null}
            {c.test_url ? (
              <Button asChild variant="outline" size="sm">
                <a href={c.test_url} download>
                  Download test.csv
                </a>
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
