import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/layout/page-header";
import { TYPE_LABEL } from "@/features/resources/resource-card";
import { pageMetadata } from "@/lib/seo";
import {
  getPublicResourceBySlug,
  listPublicResourceSlugs,
} from "@/lib/public-resources";
import { accessRank, lockHint } from "@/lib/resource-access";

type Params = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export async function generateStaticParams() {
  const slugs = await listPublicResourceSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const resource = await getPublicResourceBySlug(slug);
  if (!resource) return pageMetadata("Resource", "Study resource");
  return pageMetadata(resource.title, `${resource.subject ?? "STEM"} study resource.`);
}

export default async function ResourcePage({ params }: Params) {
  const { slug } = await params;
  const resource = await getPublicResourceBySlug(slug);
  if (!resource) notFound();

  const meta = [
    resource.subject,
    resource.level,
    resource.editionYear ? `Edition ${resource.editionYear}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Competition-gated resources never expose their file on the public site —
  // schools open them through the portal once their tier unlocks.
  const gated = accessRank(resource.access) > 0;
  const downloadHref = gated
    ? null
    : resource.hasFile
      ? `/api/resources/${resource.id}/download`
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
              target={resource.hasFile ? undefined : "_blank"}
              rel={resource.hasFile ? undefined : "noopener noreferrer"}
              className="inline-block bg-[#E8A020] text-foreground text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 mb-10 hover:bg-[#F5C55A] transition-colors"
            >
              {resource.hasFile ? "Download" : "Open resource"}
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
              {resource.body.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
