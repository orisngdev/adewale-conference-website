import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import EditionCard from "@/features/editions/edition-card";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { editionsQuery } from "@/sanity/lib/queries";
import type { EditionListItem } from "@/sanity/types";

export const metadata = pageMetadata(
  "Past Editions",
  "Explore every edition of the Adewale Students Conference — themes, champions, and highlights.",
);

export default async function EditionsPage() {
  const { data } = await sanityFetch({ query: editionsQuery });
  const editions = (data ?? []) as EditionListItem[];

  return (
    <>
      <PageHeader
        kicker="Archive"
        title="Past Editions"
        subtitle="Themes, champions, and highlights from every edition of the Conference."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          {editions.length === 0 ? (
            <EmptyState title="No editions yet">
              Editions added in the Studio will appear here automatically.
            </EmptyState>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {editions.map((edition) => (
                <EditionCard key={edition._id} edition={edition} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
