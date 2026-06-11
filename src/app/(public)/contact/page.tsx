import PageHeader from "@/components/layout/page-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Contact Us",
  "Get in touch with the Adewale Students Conference team.",
);

const CONTACTS = [
  { label: "General enquiries", email: "hello@asc2026.ng" },
  { label: "Partnerships & sponsorship", email: "partnerships@asc2026.ng" },
  { label: "Conference office", email: "adewaleconference@gmail.com" },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        kicker="Get in touch"
        title="Contact Us"
        subtitle="Reach the Adewale Students Conference team."
      />
      <section className="px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto grid gap-px bg-[rgba(10,15,30,0.1)] border border-[rgba(10,15,30,0.1)]">
          {CONTACTS.map((c) => (
            <div key={c.email} className="bg-white p-6 md:p-8">
              <div className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#4A4E5C] mb-2">
                {c.label}
              </div>
              <a
                href={`mailto:${c.email}`}
                className="font-bebas text-2xl md:text-3xl text-[#0A0F1E] hover:text-[#E8A020] transition-colors"
              >
                {c.email}
              </a>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
