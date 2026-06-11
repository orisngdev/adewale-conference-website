import PageHeader from "@/components/layout/page-header";
import ComingSoon from "@/components/ui/coming-soon";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "About",
  "The mission behind the Adewale Students Conference — Ogun State's most ambitious student STEM platform.",
);

export default function AboutPage() {
  return (
    <>
      <PageHeader
        kicker="The Mission"
        title="About ASC"
        subtitle="Ogun State's most ambitious student STEM platform — building tomorrow's geniuses today."
      />
      <ComingSoon>
        Our full story, mission, impact, and the team behind the Conference will live here.
      </ComingSoon>
    </>
  );
}
