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
import Link from "next/link";
import { accessRank, lockHint } from "@/lib/resource-access";

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

  // Competition-gated resources never expose their file/body on the public
  // site — schools access them through the portal once their tier unlocks.
  const gated = accessRank(resource.access) > 0;
  const downloadHref = gated
    ? null
    : resource.fileUrl
      ? `${resource.fileUrl}?dl=`
      : resource.externalUrl;

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
              className="inline-block bg-[#E8A020] text-foreground text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 mb-10 hover:bg-[#F5C55A] transition-colors"
            >
              {resource.fileUrl ? "Download" : "Open resource"}
            </a>
          ) : null}

          {gated ? (
            <div className="border border-dashed border-foreground/20 p-8 mb-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                Competition material
              </p>
              <p className="font-bebas text-2xl text-foreground mt-1">
                This resource is for participating schools
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {lockHint(resource.access)}. Students and educators of participating
                schools can access it from the portal.
              </p>
              <Link
                href="/portal"
                className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-primary hover:underline"
              >
                Go to the portal →
              </Link>
            </div>
          ) : null}

          {!gated && resource.body ? (
            <div className="prose-resource serif-display text-lg text-foreground leading-relaxed space-y-4">
              <PortableText value={resource.body} />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
