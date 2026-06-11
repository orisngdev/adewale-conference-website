import Image from "next/image";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { sponsorsQuery } from "@/sanity/lib/queries";
import { urlForImage } from "@/sanity/lib/image";
import type { Sponsor } from "@/sanity/types";

export const metadata = pageMetadata("Sponsors", "Conference sponsors and partners.");
export const dynamic = "force-dynamic";

const TIER_ORDER = ["Platinum", "Gold", "Silver", "Bronze", "Partner", "Other"];

export default async function AdminSponsors() {
  const { data } = await sanityFetch({ query: sponsorsQuery, params: {} });
  const sponsors = (data ?? []) as Sponsor[];

  const byTier = new Map<string, Sponsor[]>();
  for (const s of sponsors) {
    const tier = s.tier && TIER_ORDER.includes(s.tier) ? s.tier : "Other";
    byTier.set(tier, [...(byTier.get(tier) ?? []), s]);
  }
  const tiers = TIER_ORDER.filter((t) => byTier.has(t));

  return (
    <>
      <PortalHeader title="Sponsors" subtitle="Authored in the Sanity Studio" />
      <PortalBody>
        {sponsors.length === 0 ? (
          <EmptyState title="No sponsors yet">
            Add sponsors in the Studio and they&apos;ll appear here and on the public site.
          </EmptyState>
        ) : (
          tiers.map((tier) => (
            <div key={tier}>
              <SectionHeading action={{ href: "/studio", label: "Edit in Studio →" }}>
                {tier}
              </SectionHeading>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {byTier.get(tier)!.map((s) => (
                  <Card key={s._id} className="p-5 flex items-center gap-4">
                    {s.logo ? (
                      <Image
                        src={urlForImage(s.logo).width(96).height(96).fit("max").url()}
                        alt={s.name}
                        width={48}
                        height={48}
                        className="object-contain"
                      />
                    ) : null}
                    <div>
                      <h3 className="font-bebas text-xl text-[#0A0F1E]">{s.name}</h3>
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-[#E8A020] hover:underline"
                        >
                          Visit site →
                        </a>
                      ) : null}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </PortalBody>
    </>
  );
}
