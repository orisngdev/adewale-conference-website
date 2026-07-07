import { notFound } from "next/navigation";
import Image from "next/image";
import { PortableText } from "next-sanity";
import PageHeader from "@/components/layout/page-header";
import { pageMetadata } from "@/lib/seo";
import { client } from "@/sanity/lib/client";
import { sanityFetch } from "@/sanity/lib/live";
import { editionByYearQuery, editionYearsQuery } from "@/sanity/lib/queries";
import { urlForImage } from "@/sanity/lib/image";
import { projectId } from "@/sanity/env";
import type { Edition } from "@/sanity/types";

type Params = { params: Promise<{ year: string }> };

// Pre-build a page per known year. Uses the raw client (the live sanityFetch
// can't run outside a request scope).
export async function generateStaticParams() {
  if (!projectId) return [];
  const years = await client.fetch<number[]>(editionYearsQuery);
  return (years ?? []).map((year) => ({ year: String(year) }));
}

export async function generateMetadata({ params }: Params) {
  const { year } = await params;
  const { data } = await sanityFetch({
    query: editionByYearQuery,
    params: { year: Number(year) },
  });
  const edition = data as Edition | null;
  if (!edition) return pageMetadata("Edition", `Adewale Students Conference ${year}`);
  return pageMetadata(
    `${edition.theme} (${edition.year})`,
    `The ${edition.year} edition of the Adewale Students Conference.`,
  );
}

export default async function EditionPage({ params }: Params) {
  const { year } = await params;
  const { data } = await sanityFetch({
    query: editionByYearQuery,
    params: { year: Number(year) },
  });
  const edition = data as Edition | null;
  if (!edition) notFound();

  return (
    <>
      <PageHeader kicker={`Edition ${edition.year}`} title={edition.theme} />

      <section className="px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          {edition.heroImage ? (
            <div className="relative aspect-[16/9] bg-[#0A0F1E] mb-12">
              <Image
                src={urlForImage(edition.heroImage).width(1280).height(720).url()}
                alt={edition.theme}
                fill
                className="object-cover"
                sizes="(max-width: 896px) 100vw, 896px"
                priority
              />
            </div>
          ) : null}

          {edition.stats && edition.stats.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[rgba(10,15,30,0.12)] mb-12">
              {edition.stats.map((stat, i) => (
                <div key={i} className="bg-[#FAF7F0] p-5">
                  <div className="font-bebas text-3xl md:text-4xl text-primary leading-none">
                    {stat.value}
                  </div>
                  <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-2">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {edition.summary ? (
            <div className="prose-edition serif-display text-lg text-foreground leading-relaxed space-y-4">
              <PortableText value={edition.summary} />
            </div>
          ) : null}

          {edition.sponsors && edition.sponsors.length > 0 ? (
            <div className="mt-12 pt-12 border-t border-[rgba(10,15,30,0.12)]">
              <h2 className="font-bebas text-2xl text-foreground mb-5">Sponsors</h2>
              <ul className="flex flex-wrap gap-3 list-none">
                {edition.sponsors.map((sponsor) => (
                  <li
                    key={sponsor._id}
                    className="border border-[rgba(10,15,30,0.12)] px-4 py-2 text-sm text-foreground"
                  >
                    {sponsor.name}
                    {sponsor.tier ? (
                      <span className="text-muted-foreground"> · {sponsor.tier}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
