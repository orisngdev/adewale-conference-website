import Link from "next/link";
import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { Button } from "@/components/ui/button";
import MaterialDownloadButton from "@/components/portal/material-download-button";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { sanityFetch } from "@/sanity/lib/live";
import { resourcesQuery } from "@/sanity/lib/queries";
import type { ResourceListItem } from "@/sanity/types";
import { SUBJECTS, LEVELS } from "@/lib/assessments";
import { canAccess, lockHint } from "@/lib/resource-access";

export const metadata = pageMetadata("Resources", "Study packs, past questions, and tools.");
export const dynamic = "force-dynamic";

const selCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

// Official state systems — always shown; admins can add more via Sanity (type "external-link").
const OFFICIAL_LINKS = [
  { title: "OgunLEARN", url: "https://learn.ogunstate.gov.ng/", note: "State lesson-notes platform" },
  { title: "DiPER", url: "https://diper.ogunstate.gov.ng/", note: "Learner ID & records" },
];

export default async function StudentResources({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string; level?: string; type?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const sp = await searchParams;
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  // Tiered access: competition material unlocks with the school's status
  // (accepted → qualified → finalist). Locked items are listed as motivation,
  // but their file URLs are withheld here on the server — they never reach the
  // browser of anyone below the tier.
  const [{ data }, { data: schoolData }] = await Promise.all([
    sanityFetch({
      query: resourcesQuery,
      params: { type: sp.type ?? "", subject: sp.subject ?? "", level: sp.level ?? "" },
    }),
    supabase.rpc("get_my_school"),
  ]);
  const status =
    ((schoolData as { registration?: { status?: string } | null } | null)?.registration
      ?.status as string | undefined) ?? null;

  const resources = (data ?? []) as ResourceListItem[];
  const withLock = (r: ResourceListItem) => ({ r, locked: !canAccess(r.access, status) });
  const packs = resources
    .filter((r) => r.hasFile && r.type !== "external-link")
    .map(withLock)
    .sort((a, b) => Number(a.locked) - Number(b.locked));
  const links = resources
    .filter((r) => r.type === "external-link" || (!r.hasFile && r.externalUrl))
    .map(withLock);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Filter</SectionHeading>
        <Card className="p-4">
          <form method="get" className="flex flex-wrap items-center gap-2">
            <select name="subject" defaultValue={sp.subject ?? ""} className={selCls}>
              <option value="">Any subject</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select name="level" defaultValue={sp.level ?? ""} className={selCls}>
              <option value="">Any level</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <select name="type" defaultValue={sp.type ?? ""} className={selCls}>
              <option value="">Any type</option>
              <option value="past-question">Past questions</option>
              <option value="study-guide">Study guides</option>
              <option value="syllabus">Syllabus</option>
              <option value="video">Video</option>
            </select>
            <Button type="submit" size="sm" variant="outline">Apply</Button>
          </form>
        </Card>
      </div>

      <div>
        <SectionHeading action={{ href: "/resources", label: "All resources →" }}>
          Study packs &amp; past questions
        </SectionHeading>
        {packs.length === 0 ? (
          <EmptyState title="Study packs will appear here as they're published." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map(({ r, locked }) => (
              <Card key={r._id} className={`p-5 h-full flex flex-col ${locked ? "opacity-75" : ""}`}>
                {r.type ? (
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    {r.type.replace("-", " ")}
                  </span>
                ) : null}
                <h4 className="font-bebas text-xl text-foreground mt-1">{r.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {[r.subject, r.level].filter(Boolean).join(" · ")}
                </p>
                {locked ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="size-3.5 shrink-0 text-gold-ink" />
                    {lockHint(r.access)}
                  </p>
                ) : r.fileUrl ? (
                  <MaterialDownloadButton resourceId={r._id} fileUrl={r.fileUrl} fileName={r.fileName} />
                ) : r.slug ? (
                  <Link
                    href={`/resources/${r.slug}`}
                    className="mt-3 text-xs uppercase tracking-[0.15em] text-primary hover:underline"
                  >
                    Open →
                  </Link>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionHeading>Additional resources</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICIAL_LINKS.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="block group">
              <Card interactive className="p-5 h-full">
                <h4 className="font-bebas text-lg text-foreground">{l.title} ↗</h4>
                <p className="text-sm text-muted-foreground mt-1">{l.note}</p>
              </Card>
            </a>
          ))}
          {links.map(({ r, locked }) =>
            locked ? (
              <Card key={r._id} className="p-5 h-full opacity-75">
                <h4 className="font-bebas text-lg text-foreground">{r.title}</h4>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5 shrink-0 text-gold-ink" />
                  {lockHint(r.access)}
                </p>
              </Card>
            ) : (
              <a
                key={r._id}
                href={r.externalUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block group"
              >
                <Card interactive className="p-5 h-full">
                  <h4 className="font-bebas text-lg text-foreground">{r.title} ↗</h4>
                  {r.subject ? <p className="text-sm text-muted-foreground mt-1">{r.subject}</p> : null}
                </Card>
              </a>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
