import { notFound } from "next/navigation";
import Image from "next/image";
import { PortableText } from "next-sanity";
import PageHeader from "@/components/layout/page-header";
import { pageMetadata } from "@/lib/seo";
import { formatDate } from "@/lib/format";
import { client } from "@/sanity/lib/client";
import { sanityFetch } from "@/sanity/lib/live";
import { newsBySlugQuery, newsSlugsQuery } from "@/sanity/lib/queries";
import { urlForImage } from "@/sanity/lib/image";
import { projectId } from "@/sanity/env";
import type { NewsPost } from "@/sanity/types";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!projectId) return [];
  const slugs = await client.fetch<string[]>(newsSlugsQuery);
  return (slugs ?? []).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const { data } = await sanityFetch({ query: newsBySlugQuery, params: { slug } });
  const post = data as NewsPost | null;
  if (!post) return pageMetadata("News", "Adewale Students Conference news");
  return pageMetadata(post.title, post.excerpt ?? "Adewale Students Conference news");
}

export default async function NewsArticlePage({ params }: Params) {
  const { slug } = await params;
  const { data } = await sanityFetch({ query: newsBySlugQuery, params: { slug } });
  const post = data as NewsPost | null;
  if (!post) notFound();

  const meta = [formatDate(post.publishedAt), post.author?.name].filter(Boolean).join(" · ");

  return (
    <>
      <PageHeader kicker={meta || "News"} title={post.title} />
      <section className="px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {post.coverImage ? (
            <div className="relative aspect-[16/9] bg-[#0A0F1E] mb-10">
              <Image
                src={urlForImage(post.coverImage).width(1280).height(720).url()}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 896px) 100vw, 896px"
                priority
              />
            </div>
          ) : null}

          {post.body ? (
            <div className="prose-news serif-display text-lg text-[#0A0F1E] leading-relaxed space-y-4">
              <PortableText value={post.body} />
            </div>
          ) : null}

          {post.tags && post.tags.length > 0 ? (
            <ul className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-[rgba(10,15,30,0.12)] list-none">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#4A4E5C] border border-[rgba(10,15,30,0.2)] px-3 py-1"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </>
  );
}
