import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import GalleryGrid from "@/features/gallery/gallery-grid";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { galleryItemsQuery } from "@/sanity/lib/queries";
import type { GalleryItem } from "@/sanity/types";

export const metadata = pageMetadata(
  "Gallery",
  "Photos and highlights from past editions of the Adewale Students Conference.",
);

export default async function GalleryPage() {
  const { data } = await sanityFetch({ query: galleryItemsQuery });
  const items = (data ?? []) as GalleryItem[];

  return (
    <>
      <PageHeader
        kicker="Media"
        title="Gallery"
        subtitle="Photos and highlights from past editions."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          {items.length === 0 ? (
            <EmptyState title="No photos yet">
              Gallery images added in the Studio will appear here.
            </EmptyState>
          ) : (
            <GalleryGrid items={items} />
          )}
        </div>
      </section>
    </>
  );
}
