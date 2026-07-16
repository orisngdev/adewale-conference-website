import Link from "next/link";
import PageHeader from "@/components/layout/page-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Our Sponsors",
  "Partner with the Adewale Students Conference to power STEM opportunity for students.",
);

// Sponsor partnerships are handled by the ASC team (enquiries come through the
// public sponsorship form → Airtable). This page is an invitation to partner —
// there is no Sanity-authored sponsor list.
export default function SponsorsPage() {
  return (
    <>
      <PageHeader
        kicker="Partners"
        title="Our Sponsors"
        subtitle="The organisations powering STEM opportunity for students."
      />
      <section className="px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="serif-display italic text-xl md:text-2xl text-foreground leading-relaxed">
            Every edition of the Adewale Students Conference is made possible by
            organisations that believe in Ogun State&apos;s young innovators.
          </p>
          <p className="text-muted-foreground mt-6 leading-relaxed">
            We partner across Platinum, Gold, Silver, Bronze and Scholarship tiers —
            with naming rights, branded stages, shortlist access, and named
            scholarships. Tell us how you&apos;d like to be involved and our team
            will send the full sponsorship deck within 48 hours.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/#partner"
              className="inline-block bg-[#E8A020] text-foreground text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 hover:bg-[#F5C55A] transition-colors"
            >
              Become a Sponsor
            </Link>
            <a
              href="mailto:partnerships@asc2026.ng"
              className="inline-block border border-foreground/20 text-foreground text-xs font-bold tracking-[0.2em] uppercase px-6 py-3 hover:border-[#E8A020] hover:text-primary transition-colors"
            >
              partnerships@asc2026.ng
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
