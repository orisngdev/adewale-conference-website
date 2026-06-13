import PageHeader from "@/components/layout/page-header";
import FaqList, { type FaqGroup } from "@/features/faq/faq-list";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Frequently Asked Questions",
  "Everything students, schools, and parents need to know about taking part in the Adewale Students Conference.",
);

const GROUPS: FaqGroup[] = [
  {
    title: "For Students",
    items: [
      {
        q: "Which students are eligible to take part?",
        a: "The STEM Contest is open to SS1 and SS2 students, in teams of up to three students per school. Each team must have at least one female student (except single-gender schools) and be accompanied by a registered supervising teacher.",
      },
      {
        q: "Can I enter on my own?",
        a: "No — students take part through their school, as part of a team led by a supervising teacher. Speak to a teacher at your school about registering.",
      },
      {
        q: "What are the competition categories?",
        a: "There are two: the STEM Contest and the Innovation Pitch. Your school's team can take part across the categories offered for the edition.",
      },
      {
        q: "Does it cost anything to participate?",
        a: "No. Participation is completely free for students and schools — there are no fees at any stage.",
      },
    ],
  },
  {
    title: "For Schools & Teachers",
    items: [
      {
        q: "Is participation free for schools?",
        a: "Yes. Registration and participation in all ASC categories are completely free for schools and students, with no hidden fees at any stage.",
      },
      {
        q: "Which schools can participate?",
        a: "ASC is open to all secondary schools across Ogun State. The programme is statewide and we actively encourage schools from every LGA to register.",
      },
      {
        q: "How does my school register?",
        a: "A coordinating teacher completes the online registration form, entering the school's details and up to three student representatives. You'll receive a confirmation email once it's submitted.",
      },
      {
        q: "Can we manage our entry online?",
        a: "Yes. Your confirmation email includes a claim code — sign in to the school portal, enter the code, and you can track your registration status, manage your representatives, and download certificates.",
      },
    ],
  },
  {
    title: "The Competition",
    items: [
      {
        q: "What are the stages of the competition?",
        a: "There is a zonal stage held across the state, after which qualifying schools advance to the Grand Finale in October.",
      },
      {
        q: "What happens if our school wins the zonal stage?",
        a: "Qualifying schools advance to the October Grand Finale. Travel and accommodation for the qualifying student team and their supervising teacher are covered in full by the ASC programme.",
      },
      {
        q: "Where is the Grand Finale held?",
        a: "The Grand Finale is hosted in Abeokuta, bringing together the top schools from across Ogun State.",
      },
    ],
  },
  {
    title: "General",
    items: [
      {
        q: "When does registration close?",
        a: "Registration dates are announced for each edition. Check the homepage and the News page for the current deadline.",
      },
      {
        q: "How do students receive their certificates?",
        a: "Certificates are issued through the school portal once results are confirmed, and can be downloaded by the coordinating teacher.",
      },
      {
        q: "How do I contact the organisers?",
        a: "Email adewaleconference@gmail.com and we'll respond within 24 hours.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <>
      <PageHeader
        kicker="Questions"
        title="Frequently Asked Questions"
        subtitle="Everything students, schools, and parents need to know about taking part."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-4xl mx-auto">
          <FaqList groups={GROUPS} />
          <p className="mt-12 text-sm md:text-base text-[#555870]">
            Still have a question? Email{" "}
            <a
              href="mailto:adewaleconference@gmail.com"
              className="font-bold text-[#0A0F1E] underline underline-offset-2 hover:text-[#E8A020] transition-colors"
            >
              adewaleconference@gmail.com
            </a>{" "}
            and we&apos;ll respond within 24 hours.
          </p>
        </div>
      </section>
    </>
  );
}
