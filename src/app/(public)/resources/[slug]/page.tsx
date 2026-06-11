import { notFound } from "next/navigation";
import { PortableText } from "next-sanity";
import PageHeader from "@/components/layout/page-header";
import { TYPE_LABEL } from "@/features/resources/resource-card";
import { pageMetadata } from "@/lib/seo";
import { client } from "@/sanity/lib/client";
import { sanityFetch } from "@/sanity/lib/live";
import { resourceBySlugQuery, resourceSlugsQuery } from "@/sanity/lib/queries";
import { projectId } from "@/sanity/env";
import type { Resource } from "@/sanity/types";

type Params = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  if (!projectId) return [];
  const slugs = await client.fetch<string[]>(resourceSlugsQuery);
  return (slugs ?? []).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const { data } = await sanityFetch({ query: resourceBySlugQuery, params: { slug } });
  const resource = data as Resource | null;
  if (!resource) return pageMetadata("Resource", "Study resource");
  return pageMetadata(resource.title, `${resource.subject ?? "STEM"} study resource.`);
}

export default async function ResourcePage({ params }: Params) {
  const { slug } = await params;
  const { data } = await sanityFetch({ query: resourceBySlugQuery, params: { slug } });
  const resource = data as Resource | null;
  if (!resource) notFound();

  const meta = [
    resource.subject,
    resource.level,
    resource.edition ? `Edition ${resource.edition.year}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const downloadHref = resource.fileUrl ? `${resource.fileUrl}?dl=` : resource.externalUrl;

  return (
    <>
      <PageHeader
        kicker={resource.type ? (TYPE_LABEL[resource.type] ?? resource.type) : "Resource"}
        title={resource.title}
        subtitle={meta || undefined}
      />
      <section className="px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          {downloadHref ? (
            <a
              href={downloadHref}
              target={resource.fileUrl ? undefined : "_blank"}
              rel={resource.fileUrl ? undefined : "noopener noreferrer"}
              className="inline-block bg-[#E8A020] text-[#0A0F1E] text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 mb-10 hover:bg-[#F5C55A] transition-colors"
            >
              {resource.fileUrl ? "Download" : "Open resource"}
            </a>
          ) : null}

          {resource.body ? (
            <div className="prose-resource serif-display text-lg text-[#0A0F1E] leading-relaxed space-y-4">
              <PortableText value={resource.body} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
