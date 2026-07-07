import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import SponsorCard from "@/features/sponsors/sponsor-card";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { sponsorsQuery } from "@/sanity/lib/queries";
import type { Sponsor } from "@/sanity/types";

export const metadata = pageMetadata(
  "Our Sponsors",
  "The organisations powering STEM opportunity for students through the Adewale Students Conference.",
);

const TIER_ORDER = ["Platinum", "Gold", "Silver", "Bronze", "Scholarship"];

function groupByTier(sponsors: Sponsor[]) {
  const map = new Map<string, Sponsor[]>();
  for (const sponsor of sponsors) {
    const tier = sponsor.tier && TIER_ORDER.includes(sponsor.tier) ? sponsor.tier : "Other";
    const list = map.get(tier) ?? [];
    list.push(sponsor);
    map.set(tier, list);
  }
  return [...TIER_ORDER, "Other"]
    .filter((tier) => map.has(tier))
    .map((tier) => [tier, map.get(tier)!] as const);
}

export default async function SponsorsPage() {
  const { data } = await sanityFetch({ query: sponsorsQuery });
  const sponsors = (data ?? []) as Sponsor[];
  const groups = groupByTier(sponsors);

  return (
    <>
      <PageHeader
        kicker="Partners"
        title="Our Sponsors"
        subtitle="The organisations powering STEM opportunity for students."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-6xl mx-auto">
          {sponsors.length === 0 ? (
            <EmptyState title="Sponsors coming soon">
              Our partners will be featured here. Interested in sponsoring? Reach us at
              partnerships@asc2026.ng.
            </EmptyState>
          ) : (
            <div className="space-y-12">
              {groups.map(([tier, list]) => (
                <div key={tier}>
                  <h2 className="font-bebas text-2xl text-foreground mb-4">{tier}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {list.map((sponsor) => (
                      <SponsorCard key={sponsor._id} sponsor={sponsor} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-16 border-t border-[rgba(10,15,30,0.12)] pt-10 text-center">
            <p className="serif-display italic text-lg text-muted-foreground">
              Interested in partnering with us?
            </p>
            <a
              href="mailto:partnerships@asc2026.ng"
              className="inline-block mt-4 bg-[#E8A020] text-foreground text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 hover:bg-[#F5C55A] transition-colors"
            >
              Become a Sponsor
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
