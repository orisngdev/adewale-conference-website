import Link from "next/link";
import PageHeader from "@/components/layout/page-header";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Volunteer at the 2026 Zonal Finals",
  "Paid one-day volunteer roles for corps members serving in Ogun State — invigilate and mark the ASC 2026 Zonal Finals across 10 centres.",
);

// The application itself lives in a Google Form (the ASC team owns it), so this
// page is a pitch with one destination. Drop the form URL in here and every CTA
// on the page points at it; while it is empty the buttons render as a disabled
// "opening soon" state rather than dead links.
const VOLUNTEER_FORM_URL = "";

// Day-of details the ops team confirms closer to the event. Kept together so
// they can be corrected in one place instead of hunted through the copy.
const FACTS = [
  { label: "When", value: "September 2026", note: "Exact date confirmed on selection" },
  { label: "Where", value: "10 centres", note: "Across Ogun State" },
  { label: "Pay", value: "Paid role", note: "Stipend plus refreshment on the day" },
  { label: "Commitment", value: "One day", note: "Morning briefing to final results" },
];

// The run of show for a single centre. Students sit the papers; volunteers
// invigilate, mark, and get results out before leaving — all of it on the day.
const RUN_OF_SHOW = [
  {
    num: "01",
    title: "Invigilate the zonal exam",
    desc: "Your team sets up the hall, seats the school teams, and runs the objective paper under exam conditions.",
  },
  {
    num: "02",
    title: "Mark at the venue",
    desc: "Scripts are shared across the marking team and marked on site, against a scheme you are briefed on beforehand.",
  },
  {
    num: "03",
    title: "Announce the qualified schools",
    desc: "The centre lead collates and double-checks the scores, and the qualifying schools are announced the same day.",
  },
  {
    num: "04",
    title: "Run the theory paper",
    desc: "The schools that qualified sit the theory exam straight after the announcement — a much smaller hall this time.",
  },
  {
    num: "05",
    title: "Mark and return results",
    desc: "The team marks the theory scripts together and the centre results go to the ASC team before everyone heads home.",
  },
];

const CENTRES = [
  { name: "Abeokuta Grammar School", town: "Abeokuta" },
  { name: "Ansar Ud Deen Comprehensive Senior College", town: "Ota" },
  { name: "Pakoto High School", town: "Ifo" },
  { name: "Iko Gateway Grammar School", town: "Iko" },
  { name: "Methodist High School", town: "Arigbajo" },
  { name: "Comprehensive High School", town: "Ayetoro" },
  { name: "Yewa (Egbado) College, Senior", town: "Ilaro" },
  { name: "Nazareth High School", town: "Imeko" },
  { name: "Methodist Comprehensive College, Senior", town: "Sagamu" },
  { name: "Adeola Odutola College", town: "Ijebu Ode" },
];

const REQUIREMENTS = [
  "A corps member currently serving in Ogun State.",
  "Confident marking secondary-school Mathematics, Physics, Chemistry, Biology or English.",
  "Careful with figures — scores are added, cross-checked and announced the same day.",
  "Able to report to your assigned centre at the briefing time and stay until results are submitted.",
  "Happy working as part of a team and following the centre lead\u2019s instructions on the day.",
];

const PERKS = [
  {
    title: "A paid stipend",
    desc: "This is paid work, not unpaid service. The figure is confirmed with you when you are selected.",
  },
  {
    title: "Refreshment on the day",
    desc: "Food and drinks are provided at your centre. You will be looked after from briefing through to the last script.",
  },
  {
    title: "A briefing and materials",
    desc: "Marking schemes, score sheets and a full walkthrough before the first student sits down.",
  },
  {
    title: "A team around you",
    desc: "A centre lead and fellow volunteers on every shift, each with a defined role.",
  },
];

const FAQS = [
  {
    q: "Will I be on my own at a centre?",
    a: "No. Every centre is staffed by a team of volunteers under a centre lead, and the work is split between you — invigilating, marking, and recording scores. You are given one role for the day and there is always someone to ask.",
  },
  {
    q: "Do I need to be a teacher?",
    a: "No. What matters is that you are comfortable with the subject you are marking and careful with the numbers. A full briefing and a marking scheme are provided on the day.",
  },
  {
    q: "Can I choose my centre?",
    a: "You tell us your preferred centre in the form and we place you as close to you as we can. Final allocation depends on how many volunteers each centre needs.",
  },
  {
    q: "How much is the stipend?",
    a: "This is a paid role. The exact stipend is confirmed with you when you are selected. Refreshment at the centre is covered on the day, so the stipend is yours to keep.",
  },
  {
    q: "When will I hear back?",
    a: "Selected volunteers are contacted ahead of the event with their centre, reporting time and briefing details.",
  },
];

// Every CTA on the page goes through here so an unset form URL can never ship as
// a link to nowhere.
function ApplyButton({ variant = "solid" }: { variant?: "solid" | "outline" }) {
  const base =
    "inline-block text-xs font-bold tracking-[0.2em] uppercase px-8 py-4 transition-colors";
  const styles =
    variant === "solid"
      ? "bg-[#E8A020] text-foreground hover:bg-[#F5C55A]"
      : "border border-[#E8A020] text-primary hover:bg-[#E8A020] hover:text-foreground";

  if (!VOLUNTEER_FORM_URL) {
    return (
      <span
        aria-disabled="true"
        className={`${base} border border-foreground/20 text-muted-foreground cursor-not-allowed`}
      >
        Applications opening soon
      </span>
    );
  }

  return (
    <a
      href={VOLUNTEER_FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${styles}`}
    >
      Apply to volunteer
    </a>
  );
}

export default function VolunteerPage() {
  return (
    <>
      <PageHeader
        kicker="Paid · Ogun State · One day"
        title="Call for Volunteer Corps Members"
        subtitle="We are recruiting corps members serving in Ogun State to join the centre teams running the 2026 Zonal Finals across 10 centres — invigilating, marking on site, and getting the results out the same day."
      />

      {/* Quick facts — the four things a volunteer needs before reading further. */}
      <section className="px-6 md:px-12 pt-12 md:pt-16">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-px bg-[rgba(10,15,30,0.1)] border border-[rgba(10,15,30,0.1)]">
          {FACTS.map((fact) => (
            <div key={fact.label} className="bg-white p-5 md:p-6">
              <div className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-2">
                {fact.label}
              </div>
              <div className="font-bebas text-2xl md:text-3xl text-foreground leading-none">
                {fact.value}
              </div>
              <div className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {fact.note}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-6 md:px-12 py-12 md:py-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="serif-display italic text-xl md:text-2xl text-foreground leading-relaxed">
            One day. Ten centres. Hundreds of students writing, marked and
            announced before anyone goes home.
          </p>
          <p className="text-muted-foreground mt-6 leading-relaxed">
            The Zonal Finals decide which schools reach the Grand Finale, and each
            centre completes its round in a single day. Every centre is staffed by
            a team of volunteers working alongside a centre lead, so the
            invigilating, marking and score-checking are shared out — you take one
            role, with people beside you doing the rest. If you are serving in
            Ogun State, we would love to have you on a centre team.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ApplyButton />
            <Link
              href="#centres"
              className="inline-block border border-foreground/20 text-foreground text-xs font-bold tracking-[0.2em] uppercase px-8 py-4 hover:border-[#E8A020] hover:text-primary transition-colors"
            >
              See the centres
            </Link>
          </div>
        </div>
      </section>

      {/* The day, end to end. Mirrors the calendar timeline on the home page. */}
      <section className="bg-[#0A0F1E] px-6 md:px-12 py-14 md:py-20">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 md:mb-14">
            <div className="text-xs md:text-sm font-bold tracking-widest uppercase mb-4 text-primary">
              What you&apos;ll do
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl leading-tight text-white">
              The Day,<br />End To End.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
            {RUN_OF_SHOW.map((step) => (
              <div key={step.num} className="group">
                <div className="w-12 h-12 rounded-full bg-[#E8A020] text-foreground font-bebas text-lg flex items-center justify-center mb-6 shadow-lg shadow-[rgba(232,160,32,0.2)] group-hover:scale-110 transition-transform duration-300">
                  {step.num}
                </div>
                <h3 className="font-bebas text-xl md:text-2xl text-white mb-3 tracking-wide">
                  {step.title}
                </h3>
                <p className="text-sm text-[rgba(250,247,240,0.7)] leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <p className="serif-display italic text-base md:text-lg text-[rgba(250,247,240,0.7)] mt-12 max-w-2xl">
            You will not be doing all of this alone. Each centre runs with a full
            team of volunteers and a centre lead, and you are given one clear
            role for the day.
          </p>
        </div>
      </section>

      {/* The 10 centres. */}
      <section id="centres" className="px-6 md:px-12 py-16 md:py-24 scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 md:mb-12">
            <div className="text-xs md:text-sm font-bold tracking-widest uppercase mb-4 text-gold-ink">
              Where you&apos;ll be posted
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl leading-tight text-foreground">
              2026 Zonal Finals Centres
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">
              Ten centres, one day. You tell us your preferred centre when you
              apply and we place you as close to you as the numbers allow.
            </p>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[rgba(10,15,30,0.1)] border border-[rgba(10,15,30,0.1)] list-none">
            {CENTRES.map((centre, index) => (
              <li
                key={centre.name}
                className="bg-white p-5 md:p-6 flex items-start gap-4"
              >
                <span className="font-bebas text-xl text-gold-ink leading-none pt-1 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-medium text-foreground leading-snug">
                    {centre.name}
                  </span>
                  <span className="block text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground mt-2">
                    {centre.town}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Eligibility. */}
      <section className="bg-muted px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 md:gap-16">
          <div>
            <div className="text-xs md:text-sm font-bold tracking-widest uppercase mb-4 text-gold-ink">
              Who we&apos;re looking for
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl leading-tight text-foreground mb-6">
              You&apos;ll Fit If&hellip;
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              No prior competition experience is needed. You get a full briefing,
              the marking scheme, and a centre lead to escalate to on the day.
            </p>
          </div>

          <ul className="space-y-5 list-none">
            {REQUIREMENTS.map((item) => (
              <li key={item} className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="mt-2 w-2 h-2 shrink-0 bg-[#E8A020] rotate-45"
                />
                <span className="text-foreground leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What the day gives back. */}
      <section className="px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 md:mb-12">
            <div className="text-xs md:text-sm font-bold tracking-widest uppercase mb-4 text-gold-ink">
              What you get
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl leading-tight text-foreground">
              You&apos;ll Be Looked After
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[rgba(10,15,30,0.1)] border border-[rgba(10,15,30,0.1)]">
            {PERKS.map((perk) => (
              <div key={perk.title} className="bg-white p-6 md:p-8">
                <h3 className="font-bebas text-xl md:text-2xl text-foreground tracking-wide mb-3">
                  {perk.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {perk.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ. */}
      <section className="bg-muted px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-bebas text-3xl md:text-4xl leading-tight text-foreground mb-10">
            Before You Apply
          </h2>
          <div className="grid gap-px bg-[rgba(10,15,30,0.1)] border border-[rgba(10,15,30,0.1)]">
            {FAQS.map((faq) => (
              <div key={faq.q} className="bg-white p-6 md:p-8">
                <h3 className="font-bebas text-xl md:text-2xl text-foreground tracking-wide mb-3">
                  {faq.q}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA. */}
      <section className="bg-[#0A0F1E] px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-bebas text-4xl md:text-5xl lg:text-6xl leading-[0.95] text-white">
            Join A Centre Team.<br />Get Paid For It.
          </h2>
          <p className="serif-display italic text-base md:text-lg text-[rgba(250,247,240,0.7)] mt-6 leading-relaxed">
            Applications close once every centre is staffed, so send yours early.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <ApplyButton />
            <a
              href="mailto:hello@asc2026.ng"
              className="inline-block border border-[rgba(250,247,240,0.25)] text-[#F0EAD8] text-xs font-bold tracking-[0.2em] uppercase px-8 py-4 hover:border-[#E8A020] hover:text-primary transition-colors"
            >
              Ask a question
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
