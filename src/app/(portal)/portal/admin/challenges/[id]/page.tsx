import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Markdown } from "@/components/portal/markdown";
import { BmcSnapshot, ChallengeChip, ChallengeTypeBadge } from "@/components/portal/challenge-ui";
import { ChallengeTypePicker } from "@/components/portal/challenge-type-picker";
import { Card, EmptyState, PortalBody, PortalHeader, SectionHeading, StatTile } from "@/components/portal/ui";
import { FilterBar, Pagination, filterSelectCls, pageBounds, parsePage } from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { searchHaystackMatches, searchTokens } from "@/lib/search";
import { createClient } from "@/supabase/server";
import {
  deadlineInfo,
  linkFields,
  shortDate,
  textBody,
  type ChallengeEntry,
  type ChallengeType,
} from "@/lib/challenges";
import {
  deleteChallenge,
  reviewEntry,
  toggleChallengePublished,
  updateChallenge,
} from "../actions";

export const metadata = pageMetadata("Challenge", "Review entries and publish scores.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

type Challenge = {
  id: string;
  slug: string;
  title: string;
  type: ChallengeType;
  description_md: string | null;
  metric: string | null;
  deadline: string | null;
  edition_year: number | null;
  published: boolean;
};
type LbRow = { name: string; school: string | null; score: number; entries: number };

// timestamptz → "YYYY-MM-DDTHH:MM" local, for a datetime-local input.
function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default async function AdminChallengeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const { data: challengeData } = await supabase
    .from("challenges")
    .select("id, slug, title, type, description_md, metric, deadline, edition_year, published")
    .eq("id", id)
    .maybeSingle();
  if (!challengeData) notFound();
  const c = challengeData as Challenge;

  const publishToggle = (
    <form action={toggleChallengePublished.bind(null, c.id, !c.published)}>
      <ConfirmSubmitButton
        size="sm"
        variant={c.published ? "outline" : "default"}
        title={c.published ? "Unpublish this challenge?" : "Publish this challenge?"}
        description={
          c.published
            ? "Students lose access to it immediately."
            : "It becomes visible to students right away."
        }
        confirmLabel={c.published ? "Yes, unpublish" : "Yes, publish"}
      >
        {c.published ? "Unpublish" : "Publish"}
      </ConfirmSubmitButton>
    </form>
  );

  if (c.type === "data") return <DataAdminView c={c} supabase={supabase} publishToggle={publishToggle} />;

  // ── Entries ─────────────────────────────────────────────────────────────
  const { data: entryData } = await supabase
    .from("challenge_entries")
    .select("id, challenge_id, student_user_id, payload, note, submitted_at, status, score, feedback, reviewed_at")
    .eq("challenge_id", c.id)
    .order("submitted_at", { ascending: false });
  const entries = (entryData ?? []) as ChallengeEntry[];

  const userIds = [...new Set(entries.map((e) => e.student_user_id))];
  const studentByUser = new Map<string, { name: string; school: string | null }>();
  if (userIds.length) {
    const { data: students } = await supabase
      .from("students")
      .select("auth_user_id, name, school_id")
      .in("auth_user_id", userIds);
    const rows = (students ?? []) as { auth_user_id: string; name: string; school_id: string }[];
    const schoolIds = [...new Set(rows.map((s) => s.school_id).filter(Boolean))];
    const schoolName = new Map<string, string>();
    if (schoolIds.length) {
      const { data: schools } = await supabase.from("schools").select("id, name").in("id", schoolIds);
      for (const s of (schools ?? []) as { id: string; name: string }[]) schoolName.set(s.id, s.name);
    }
    for (const s of rows) {
      studentByUser.set(s.auth_user_id, { name: s.name, school: schoolName.get(s.school_id) ?? null });
    }
  }

  const enriched = entries.map((e) => ({
    ...e,
    name: studentByUser.get(e.student_user_id)?.name ?? "Student",
    school: studentByUser.get(e.student_user_id)?.school ?? null,
  }));

  const awaiting = enriched.filter((e) => e.status === "submitted").length;
  const reviewed = enriched.length - awaiting;

  // Filter + sort (awaiting first) + paginate.
  const q = searchTokens(sp.q).join(" ");
  const statusFilter = sp.status === "submitted" || sp.status === "reviewed" ? sp.status : "";
  const page = parsePage(sp.page);

  let list = enriched;
  if (statusFilter) list = list.filter((e) => e.status === statusFilter);
  if (q) {
    list = list.filter((e) => searchHaystackMatches([e.name, e.school], sp.q));
  }
  list = [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === "submitted" ? -1 : 1;
    return b.submitted_at.localeCompare(a.submitted_at);
  });
  const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const { from, to } = pageBounds(page, PAGE_SIZE);
  const pageRows = list.slice(from, to + 1);

  const dl = deadlineInfo(c.deadline);

  return (
    <>
      <PortalHeader title={c.title} subtitle="Review entries and publish scores" />
      <PortalBody>
        <Link
          href="/portal/admin/challenges"
          className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          ← All challenges
        </Link>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Entries" value={enriched.length} />
          <StatTile label="Awaiting review" value={awaiting} />
          <StatTile label="Reviewed" value={reviewed} />
          <StatTile label="Status" value={c.published ? "Published" : "Draft"} />
        </div>

        {/* ── Settings ──────────────────────────────────────────────────── */}
        <div>
          <SectionHeading
            action={
              c.published
                ? { href: `/portal/student/challenges/${c.id}`, label: "Preview as student →" }
                : undefined
            }
          >
            Challenge settings
          </SectionHeading>
          <Card className="space-y-4 p-5 md:p-6">
            <form action={updateChallenge.bind(null, c.id)} className="grid max-w-2xl gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Type</span>
                <ChallengeTypePicker defaultValue={c.type} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Title</span>
                  <input name="title" required defaultValue={c.title} className={inputCls} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Deadline</span>
                  <input
                    name="deadline"
                    type="datetime-local"
                    defaultValue={toDatetimeLocal(c.deadline)}
                    className={inputCls}
                  />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Brief (markdown)
                </span>
                <textarea name="brief" rows={4} defaultValue={c.description_md ?? ""} className={inputCls} />
              </label>
              <label className="space-y-1 sm:max-w-40">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Edition year
                </span>
                <input
                  name="edition_year"
                  inputMode="numeric"
                  defaultValue={c.edition_year ?? ""}
                  className={inputCls}
                />
              </label>
              <SubmitButton size="sm" pendingText="Saving…" className="w-40">
                Save settings
              </SubmitButton>
            </form>

            <div className="flex flex-wrap items-center gap-2 border-t border-foreground/5 pt-4">
              {publishToggle}
              <span className="text-xs text-muted-foreground">
                {c.published ? "Live for students." : "Draft — hidden from students."}
              </span>
              <div className="flex-1" />
              <form action={deleteChallenge.bind(null, c.id)}>
                <ConfirmSubmitButton
                  size="sm"
                  variant="outline"
                  destructive
                  title="Delete this challenge?"
                  description="The challenge and every student entry on it are permanently removed."
                  confirmLabel="Yes, delete challenge"
                >
                  Delete challenge
                </ConfirmSubmitButton>
              </form>
            </div>
          </Card>
        </div>

        {/* ── Reviewing ─────────────────────────────────────────────────── */}
        <div>
          <SectionHeading>
            {awaiting} awaiting review · {reviewed} reviewed
          </SectionHeading>

          {enriched.length === 0 ? (
            <EmptyState title="No entries yet." />
          ) : (
            <>
              <FilterBar q={sp.q ?? ""} placeholder="Search by student or school…">
                <select name="status" defaultValue={statusFilter} className={filterSelectCls}>
                  <option value="">All entries</option>
                  <option value="submitted">Awaiting review</option>
                  <option value="reviewed">Reviewed</option>
                </select>
              </FilterBar>

              {pageRows.length === 0 ? (
                <EmptyState title="No entries match your filters." />
              ) : (
                <Card>
                  {pageRows.map((e, i) => (
                    <div key={e.id} className={i > 0 ? "border-t border-foreground/5 p-5" : "p-5"}>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="min-w-0">
                          <b className="font-semibold text-foreground">{e.name}</b>{" "}
                          <span className="text-xs text-muted-foreground">
                            · {e.school ?? "—"} · submitted {shortDate(e.submitted_at)}
                          </span>
                        </p>
                        <span className="ml-auto">
                          {e.status === "reviewed" ? (
                            <ChallengeChip label={`Reviewed · ${e.score ?? "—"}`} tone="green" />
                          ) : (
                            <ChallengeChip label="Awaiting review" tone="gold" />
                          )}
                        </span>
                      </div>

                      <div className="mt-3">
                        <EntryPayload type={c.type} entry={e} />
                      </div>

                      <form
                        action={reviewEntry.bind(null, c.id, e.id)}
                        className="mt-4 flex flex-wrap items-center gap-2 border-t border-foreground/5 pt-4"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                          Score
                        </span>
                        <input
                          name="score"
                          type="number"
                          min={0}
                          max={100}
                          required
                          defaultValue={e.score ?? ""}
                          placeholder="0–100"
                          className="w-24 rounded-md border border-foreground/15 bg-card px-3 py-2 text-center text-sm tabular-nums outline-none focus:border-primary"
                        />
                        <input
                          name="feedback"
                          defaultValue={e.feedback ?? ""}
                          placeholder="Feedback for the student…"
                          className={`${inputCls} min-w-56 flex-1`}
                        />
                        <SubmitButton size="sm" pendingText="Saving…">
                          {e.status === "reviewed" ? "Update review" : "Save review"}
                        </SubmitButton>
                      </form>
                    </div>
                  ))}
                </Card>
              )}

              <Pagination
                page={page}
                pageCount={pageCount}
                path={`/portal/admin/challenges/${c.id}`}
                params={{ q: sp.q ?? "", status: statusFilter }}
              />
            </>
          )}
        </div>
      </PortalBody>
    </>
  );
}

// Render a submission by type (admin view).
function EntryPayload({ type, entry }: { type: ChallengeType; entry: ChallengeEntry }) {
  if (type === "pitch") return <BmcSnapshot payload={entry.payload} />;
  if (type === "text") {
    const text = textBody(entry.payload);
    return text ? (
      <p className="whitespace-pre-wrap rounded-md border border-foreground/6 bg-background p-3 text-sm text-foreground/90">
        {text}
      </p>
    ) : (
      <p className="text-sm italic text-muted-foreground">No response.</p>
    );
  }
  const { url, label } = linkFields(entry.payload);
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
    <p className="text-sm italic text-muted-foreground">No link.</p>
  );
}

// ── Data challenges: no review UI — link to the arena leaderboard instead ─────
async function DataAdminView({
  c,
  supabase,
  publishToggle,
}: {
  c: Challenge;
  supabase: Awaited<ReturnType<typeof createClient>>;
  publishToggle: React.ReactNode;
}) {
  const { data: lbData } = await supabase.rpc("get_challenge_leaderboard", { p_challenge_id: c.id });
  const leaderboard = (lbData ?? []) as LbRow[];
  const dl = deadlineInfo(c.deadline);

  return (
    <>
      <PortalHeader title={c.title} subtitle="Data challenge — auto-scored on the arena leaderboard" />
      <PortalBody>
        <Link
          href="/portal/admin/challenges"
          className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          ← All challenges
        </Link>

        <Card className="space-y-3 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <ChallengeTypeBadge type="data" suffix={c.metric?.toUpperCase()} />
            <ChallengeChip label={c.published ? "Published" : "Draft"} tone={c.published ? "green" : "grey"} />
          </div>
          <p className="text-sm text-muted-foreground">{dl.label}</p>
          <p className="text-sm text-muted-foreground">
            Data challenges are authored via the arena (they need a hidden ground-truth set), so there&apos;s
            no entry review here — submissions are scored automatically.
          </p>
          <div className="flex flex-wrap items-center gap-2 border-t border-foreground/5 pt-4">
            {publishToggle}
            {c.published ? (
              <Button asChild size="sm" variant="outline">
                <Link href={`/portal/student/challenges/${c.id}`}>Open arena →</Link>
              </Button>
            ) : null}
          </div>
        </Card>

        <div>
          <SectionHeading>Leaderboard</SectionHeading>
          {leaderboard.length === 0 ? (
            <EmptyState title="No submissions yet." />
          ) : (
            <Card className="divide-y divide-foreground/5">
              {leaderboard.map((r, i) => (
                <div key={`${r.name}-${i}`} className="flex items-center justify-between gap-3 p-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="w-6 shrink-0 font-bebas text-lg text-foreground">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-foreground">{r.name}</span>
                      {r.school ? (
                        <span className="block truncate text-xs text-muted-foreground">{r.school}</span>
                      ) : null}
                    </span>
                  </span>
                  <span className="shrink-0 font-bebas text-lg tabular-nums text-foreground">{r.score}</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </PortalBody>
    </>
  );
}
