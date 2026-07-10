import Link from "next/link";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatTile,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { resourcesQuery } from "@/sanity/lib/queries";
import type { ResourceListItem } from "@/sanity/types";
import { ACCESS_LABEL, accessRank, type ResourceAccess } from "@/lib/resource-access";

export const metadata = pageMetadata("Resources", "What students can download — authored in Sanity.");
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  "past-question": "Past questions",
  "study-guide": "Study guides",
  syllabus: "Syllabus",
  video: "Videos",
  "external-link": "External links",
};

// Read-only mirror of the published resource library (students + educators see
// exactly this). Content is AUTHORED in Sanity Studio — the button below opens
// it; publish there and it's live here instantly, no deploy.
export default async function AdminResources() {
  const { data } = await sanityFetch({
    query: resourcesQuery,
    params: { type: "", subject: "", level: "" },
  });
  const resources = (data ?? []) as ResourceListItem[];
  const downloadable = resources.filter((r) => r.hasFile);
  const external = resources.filter((r) => r.type === "external-link" || (!r.hasFile && r.externalUrl));
  const pageOnly = resources.length - downloadable.length - external.length;

  return (
    <>
      <PortalHeader
        title="Resources"
        subtitle="Study packs, guides & links — what students and educators can access"
      />
      <PortalBody>
        <Card className="p-5 border-l-4 border-l-primary flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
              Authored in Sanity Studio
            </p>
            <p className="font-bebas text-2xl text-foreground leading-tight">
              Add or update guides in the Studio
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a <span className="font-medium text-foreground">Resource</span> — title,
              type, subject, level, and the file — and hit Publish. It appears here, on the
              public library, and in the student &amp; educator portals immediately. No deploy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button asChild>
              <a href="/studio" target="_blank" rel="noopener noreferrer">
                Open Sanity Studio ↗
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/portal/student/resources">View as student →</Link>
            </Button>
          </div>
        </Card>

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Published" value={resources.length} />
          <StatTile label="Downloadable" value={downloadable.length} />
          <StatTile label="External links" value={external.length} />
          <StatTile label="Page-only" value={pageOnly} />
        </div>

        <div>
          <SectionHeading action={{ href: "/resources", label: "Public library →" }}>
            Published resources
          </SectionHeading>
          {resources.length === 0 ? (
            <EmptyState title="Nothing published yet">
              Students currently see an empty library — open the Studio above,
              add your first study pack or past questions, and publish.
            </EmptyState>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {resources.map((r) => (
                <div key={r._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {[
                        r.type ? TYPE_LABEL[r.type] ?? r.type : null,
                        r.subject,
                        r.level,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Untyped"}
                    </p>
                  </div>
                  <span className="flex items-center gap-2 shrink-0">
                    {accessRank(r.access) > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide bg-primary/[0.14] text-gold-ink">
                        🔒 {ACCESS_LABEL[r.access as Exclude<ResourceAccess, "public">] ?? r.access}
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        r.hasFile
                          ? "bg-green-100 text-green-800"
                          : r.externalUrl
                            ? "bg-primary/[0.14] text-gold-ink"
                            : "bg-foreground/5 text-muted-foreground"
                      }`}
                    >
                      {r.hasFile ? "Downloadable" : r.externalUrl ? "External link" : "Page only"}
                    </span>
                  </span>
                </div>
              ))}
            </Card>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Drafts aren&apos;t shown here — they&apos;re only visible inside the Studio until published.
          </p>
        </div>
      </PortalBody>
    </>
  );
}
