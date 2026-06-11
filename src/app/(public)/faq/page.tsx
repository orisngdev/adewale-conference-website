import PageHeader from "@/components/layout/page-header";
import ComingSoon from "@/components/ui/coming-soon";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Frequently Asked Questions",
  "Everything students, schools, and parents need to know about taking part in the Conference.",
);

export default function FaqPage() {
  return (
    <>
      <PageHeader
        kicker="Questions"
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about taking part."
      />
      <ComingSoon>
        A full set of answers for students, schools, and parents will be published here.
      </ComingSoon>
    </>
  );
}
