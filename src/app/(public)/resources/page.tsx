import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import FilterBar, { type ResourceFilters } from "@/features/resources/filter-bar";
import ResourceCard from "@/features/resources/resource-card";
import { pageMetadata } from "@/lib/seo";
import { listPublicResources } from "@/lib/public-resources";

export const metadata = pageMetadata(
  "Study Resources",
  "Past questions, study guides, and STEM materials to help students prepare and excel.",
);
export const revalidate = 300;

type Props = {
  searchParams: Promise<{ type?: string; subject?: string; level?: string }>;
};

export default async function ResourcesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters: ResourceFilters = {
    type: sp.type ?? "",
    subject: sp.subject ?? "",
    level: sp.level ?? "",
  };

  // Public library = published, public-tier, student-facing resources (the
  // portal enforces gating for everything above public tier).
  const all = await listPublicResources();
  const subjects = [...new Set(all.map((r) => r.subject).filter((s): s is string => !!s))].sort();

  const resources = all.filter(
    (r) =>
      (!filters.type || r.type === filters.type) &&
      (!filters.subject || r.subject === filters.subject) &&
      (!filters.level || r.level === filters.level),
  );
  const filtered = Boolean(filters.type || filters.subject || filters.level);

  return (
    <>
      <PageHeader
        kicker="Learning Hub"
        title="Study Resources"
        subtitle="Past questions, study guides, and materials to prepare and excel."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          <FilterBar current={filters} subjects={subjects} />
          {resources.length === 0 ? (
            <EmptyState title="No resources found">
              {filtered
                ? "Nothing matches these filters yet — try clearing them."
                : "Study resources published in the portal will appear here."}
            </EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
