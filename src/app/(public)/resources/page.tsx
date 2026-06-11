import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import FilterBar from "@/features/resources/filter-bar";
import ResourceCard from "@/features/resources/resource-card";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { resourcesQuery, resourceSubjectsQuery } from "@/sanity/lib/queries";
import type { ResourceFilters, ResourceListItem } from "@/sanity/types";

export const metadata = pageMetadata(
  "Study Resources",
  "Past questions, study guides, and STEM materials to help students prepare and excel.",
);

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

  const [{ data: list }, { data: subjectsRaw }] = await Promise.all([
    sanityFetch({ query: resourcesQuery, params: filters }),
    sanityFetch({ query: resourceSubjectsQuery, params: {} }),
  ]);

  const resources = (list ?? []) as ResourceListItem[];
  const subjects = [...new Set((subjectsRaw ?? []) as string[])].sort();
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
                : "Resources added in the Studio will appear here automatically."}
            </EmptyState>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {resources.map((resource) => (
                <ResourceCard key={resource._id} resource={resource} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
