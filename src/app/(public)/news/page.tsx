import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import NewsCard from "@/features/news/news-card";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { newsPostsQuery } from "@/sanity/lib/queries";
import type { NewsListItem } from "@/sanity/types";

export const metadata = pageMetadata(
  "News & Announcements",
  "The latest updates, stories, and announcements from the Adewale Students Conference.",
);

export default async function NewsPage() {
  const { data } = await sanityFetch({ query: newsPostsQuery });
  const posts = (data ?? []) as NewsListItem[];

  return (
    <>
      <PageHeader
        kicker="Updates"
        title="News & Announcements"
        subtitle="The latest from the Adewale Students Conference."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          {posts.length === 0 ? (
            <EmptyState title="No news yet">
              Posts published in the Studio will appear here automatically.
            </EmptyState>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <NewsCard key={post._id} post={post} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
