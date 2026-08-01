import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { ChallengeChip, ChallengeTypeBadge } from "@/components/portal/challenge-ui";
import { ChallengeTypePicker } from "@/components/portal/challenge-type-picker";
import { Card, EmptyState, PortalBody, PortalHeader, SectionHeading, StatTile } from "@/components/portal/ui";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import {
  FilterBar,
  Pagination,
  clampPage,
  filterSelectCls,
  pageBounds,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import {
  CHALLENGE_TYPES,
  CHALLENGE_TYPE_LABEL,
  deadlineInfo,
  isChallengeType,
  type ChallengeType,
} from "@/lib/challenges";
import { createChallenge } from "./actions";

export const metadata = pageMetadata("Challenges", "Create challenges, review entries, publish scores.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

type Row = {
  id: string;
  title: string;
  type: ChallengeType;
  metric: string | null;
  deadline: string | null;
  published: boolean;
};

export default async function AdminChallenges({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; published?: string; page?: string }>;
}) {
  await requireModuleView("labs");
  const canManage = await canManageModule("labs");
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const typeFilter = isChallengeType(sp.type) ? sp.type : "";
  const publishedFilter = sp.published === "yes" || sp.published === "no" ? sp.published : "";
  const requestedPage = parsePage(sp.page);
  const { from, to } = pageBounds(requestedPage, PAGE_SIZE);

  const supabase = await createClient();

  // Totals across the whole table (not just the page) for the stat tiles.
  const { data: allRows } = await supabase.from("challenges").select("id, type, published");
  const all = (allRows ?? []) as { id: string; type: ChallengeType; published: boolean }[];

  const buildQuery = () => {
    let query = supabase
      .from("challenges")
      .select("id, title, type, metric, deadline, published", { count: "exact" })
      .order("created_at", { ascending: false });
    if (q) query = query.ilike("title", `%${q}%`);
    if (typeFilter) query = query.eq("type", typeFilter);
    if (publishedFilter) query = query.eq("published", publishedFilter === "yes");
    return query;
  };

  const { data, count } = await buildQuery().range(from, to);
  let rows = (data ?? []) as Row[];
  const pageCount = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const page = clampPage(requestedPage, pageCount);
  if (page !== requestedPage) {
    const clamped = pageBounds(page, PAGE_SIZE);
    const { data: pageData } = await buildQuery().range(clamped.from, clamped.to);
    rows = (pageData ?? []) as Row[];
  }

  // Entry / submission counts for the challenges on this page.
  const ids = rows.map((r) => r.id);
  const entryIds = rows.filter((r) => r.type !== "data").map((r) => r.id);
  const dataIds = rows.filter((r) => r.type === "data").map((r) => r.id);

  const [{ data: entryData }, { data: subData }] = await Promise.all([
    entryIds.length
      ? supabase.from("challenge_entries").select("challenge_id, status").in("challenge_id", entryIds)
      : Promise.resolve({ data: [] as { challenge_id: string; status: string }[] }),
    dataIds.length
      ? supabase.from("challenge_submissions").select("challenge_id").in("challenge_id", dataIds)
      : Promise.resolve({ data: [] as { challenge_id: string }[] }),
  ]);

  const entryCounts = new Map<string, { total: number; reviewed: number }>();
  for (const e of (entryData ?? []) as { challenge_id: string; status: string }[]) {
    const c = entryCounts.get(e.challenge_id) ?? { total: 0, reviewed: 0 };
    c.total += 1;
    if (e.status === "reviewed") c.reviewed += 1;
    entryCounts.set(e.challenge_id, c);
  }
  const subCounts = new Map<string, number>();
  for (const s of (subData ?? []) as { challenge_id: string }[]) {
    subCounts.set(s.challenge_id, (subCounts.get(s.challenge_id) ?? 0) + 1);
  }

  const publishedCount = all.filter((c) => c.published).length;

  return (
    <>
      <PortalHeader title="Challenges" subtitle="Create challenges, review entries, publish scores" />
      <PortalBody>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="Challenges" value={all.length} />
          <StatTile label="Published" value={publishedCount} />
          <StatTile label="Drafts" value={all.length - publishedCount} />
          <StatTile label="Reviewable types" value={all.filter((c) => c.type !== "data").length} />
        </div>

        {/* ── Create ────────────────────────────────────────────────────── */}
        {canManage ? (
        <div>
          <SectionHeading>New challenge</SectionHeading>
          <Card className="p-5 md:p-6">
            <form action={createChallenge} className="grid max-w-2xl gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Type</span>
                <ChallengeTypePicker />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Title</span>
                  <input name="title" required placeholder="e.g. Pitch for Ogun 2026" className={inputCls} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Deadline (optional)
                  </span>
                  <input name="deadline" type="datetime-local" className={inputCls} />
                </label>
              </div>
              <label className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Brief (markdown)
                </span>
                <textarea
                  name="brief"
                  rows={4}
                  placeholder="What students should do, and how it's judged."
                  className={inputCls}
                />
              </label>
              <label className="space-y-1 sm:max-w-40">
                <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Edition year (optional)
                </span>
                <input name="edition_year" inputMode="numeric" placeholder="2026" className={inputCls} />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" name="published" className="size-4 accent-primary" />
                Publish now (uncheck to save as a draft)
              </label>
              <SubmitButton size="sm" pendingText="Creating…" className="w-40">
                Create challenge
              </SubmitButton>
            </form>
          </Card>
        </div>
        ) : null}

        {/* ── List ──────────────────────────────────────────────────────── */}
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
            <SectionHeading>All challenges</SectionHeading>
            {!canManage ? <ReadOnlyBadge /> : null}
          </div>
          <FilterBar q={q} placeholder="Search by title…">
            <select name="type" defaultValue={typeFilter} className={filterSelectCls}>
              <option value="">All types</option>
              {CHALLENGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CHALLENGE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <select name="published" defaultValue={publishedFilter} className={filterSelectCls}>
              <option value="">Any status</option>
              <option value="yes">Published</option>
              <option value="no">Draft</option>
            </select>
          </FilterBar>

          {rows.length === 0 ? (
            <EmptyState title="No challenges match — create one above." />
          ) : (
            <Card>
              {rows.map((r, i) => {
                const dl = deadlineInfo(r.deadline);
                const ec = entryCounts.get(r.id);
                const meta =
                  r.type === "data"
                    ? [r.metric?.toUpperCase(), dl.label, `${subCounts.get(r.id) ?? 0} submissions`]
                        .filter(Boolean)
                        .join(" · ")
                    : [dl.label, `${ec?.total ?? 0} entries`, `${ec?.reviewed ?? 0} reviewed`].join(" · ");
                const action =
                  r.type === "data" ? "Leaderboard" : r.published ? "Review entries" : "Edit";
                return (
                  <div
                    key={r.id}
                    className={`flex flex-wrap items-center gap-3 p-4 ${i > 0 ? "border-t border-foreground/5" : ""}`}
                  >
                    <ChallengeTypeBadge type={r.type} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{r.title}</p>
                      <p className="text-xs text-muted-foreground">{meta}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ChallengeChip
                        label={r.published ? "Published" : "Draft"}
                        tone={r.published ? "green" : "grey"}
                      />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/portal/admin/challenges/${r.id}`}>{action}</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/challenges"
            params={{ q, type: typeFilter, published: publishedFilter }}
          />
        </div>
      </PortalBody>
    </>
  );
}
