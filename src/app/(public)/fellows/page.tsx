import Link from "next/link";
import PageHeader from "@/components/layout/page-header";
import FellowsApplyButton from "@/components/sections/fellows-apply-button";
import { ZONAL_CENTRES_2026 } from "@/lib/forms";
import {
  FELLOWS_APPLICATIONS_CLOSE,
  FELLOWS_CENTRE_COUNT,
  FELLOWS_EVENT_DATE,
  FELLOWS_EVENT_HOURS,
  FELLOWS_HEADCOUNT,
} from "@/lib/fellows-programme";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Adéwálé NYSC Fellows Programme",
  "Paid one-day Fellowships for corps members serving in Ogun State — administer the ASC 2026 Zonal Finals across 10 centres on Wednesday, 23 September 2026.",
);

// Day-of facts. The programme constants live in lib/fellows-programme.ts because
// the application modal and both emails quote the same dates — one module means
// they cannot contradict each other.
const FACTS = [
  { label: "When", value: "23 Sept 2026", note: `Wednesday, ${FELLOWS_EVENT_HOURS}` },
  { label: "Where", value: `${FELLOWS_CENTRE_COUNT} centres`, note: "Across Ogun State" },
  { label: "Pay", value: "Paid role", note: "Stipend, transport and feeding" },
  { label: "Commitment", value: "One day", note: "Plus two short training sessions" },
];

// The run of show for a single centre. Students sit the papers; Fellows
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
    desc: "Marking runs on our AI-powered marking app, so scripts are scored on site in minutes rather than by hand. You are trained on it in the briefing.",
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
    desc: "The team runs the theory scripts through the app the same way, and the centre results go to the ASC team before everyone heads home.",
  },
];

const REQUIREMENTS = [
  "A corps member currently serving in Ogun State.",
  "Comfortable with secondary-school Mathematics, Physics, Chemistry, Biology or English — enough to check the app’s work.",
  "Open to learning something new — we train you on the marking app, and you will not have used it before either.",
  "Free for the whole of Wednesday, 23 September 2026, and for two short training sessions the week before.",
  "Happy working as part of a team and following the centre lead’s instructions on the day.",
];

const ROLES = [
  {
    title: "Centre Lead",
    desc: "Runs the centre for the day: holds the timetable, collates and double-checks the scores, and announces the qualifying schools.",
  },
  {
    title: "Invigilator",
    desc: "Sets up and supervises a hall, keeps exam conditions, and works the marking app on the scripts from that hall.",
  },
  {
    title: "Registration & Materials Officer",
    desc: "Signs in the school teams, issues and accounts for every question paper and script, and keeps the centre’s paperwork straight.",
  },
];

const PERKS = [
  {
    title: "A paid stipend",
    desc: "This is paid work, not unpaid service. Fellows are paid on the day, with transport and feeding allowances on top of the stipend.",
  },
  {
    title: "A Certificate of Fellowship",
    desc: "Formal recognition of your service as an examination official, issued by the Adéwálé Foundation.",
  },
  {
    title: "Training you keep",
    desc: "Two sessions in examination administration before the day, plus a full walkthrough of the AI marking app — skills that outlast the fellowship.",
  },
  {
    title: "A route back in",
    desc: "Outstanding Fellows are invited back as paid judges at the residential camp.",
  },
];

const SELECTION_STEPS = [
  {
    title: "Apply",
    desc: "Seventeen questions, about four minutes. Nothing to upload and no essay to write.",
  },
  {
    title: "A short conversation",
    desc: "Shortlisted applicants get a ten-minute call on WhatsApp. It is a conversation, not an examination.",
  },
  {
    title: "Two training sessions",
    desc: "One online, one in person, in the week before. Both are compulsory — examination administration and the marking app.",
  },
  {
    title: "Examination day",
    desc: "You report to your centre, run your role alongside your team, and are paid on the day.",
  },
];

const FAQS = [
  {
    q: "Will I be on my own at a centre?",
    a: "No. Every centre is staffed by a team of Fellows under a Centre Lead, and the work is split between you — invigilating, marking, and recording scores. You are given one role for the day and there is always someone to ask.",
  },
  {
    q: "How does the marking actually work?",
    a: "Through an AI-powered marking app that we train you on before the day. It does the scoring; your job is to run it properly and confirm the results look right. It is what makes finishing a whole zonal round in one day possible.",
  },
  {
    q: "Do I need to be a teacher?",
    a: "No. Marking is done through our AI-powered marking app rather than by hand, so you are checking and confirming its work rather than grading a pile of scripts yourself. Training and a full walkthrough are provided.",
  },
  {
    q: "What is the training, and is it compulsory?",
    a: "Two short sessions in the week before — one online, one in person — covering examination administration and the marking app. Both are compulsory: a centre only runs to time if everyone in it has been through the same briefing.",
  },
  {
    q: "Can I choose my centre?",
    a: "You tell us your preferred centre when you apply and we place you as close to you as we can. Final allocation depends on how many Fellows each centre needs, and we pay transport if we post you further afield.",
  },
  {
    q: "How much is the stipend?",
    a: "This is a paid role. Fellows are paid on the day, with transport and feeding allowances on top, and the exact figure is confirmed with you when you are selected.",
  },
  {
    q: "When will I hear back?",
    a: "Shortlisted applicants are contacted on WhatsApp for a short conversation. If you are selected you will be told your centre, your role for the day, and the training times.",
  },
];

export default function FellowsPage() {
  return (
    <>
      <PageHeader
        kicker="Paid · Ogun State · One day"
        title="Adéwálé NYSC Fellows Programme"
        subtitle={`We are recruiting ${
          FELLOWS_HEADCOUNT ? `about ${FELLOWS_HEADCOUNT} ` : ""
        }corps members serving in Ogun State to administer the 2026 Zonal Finals across ${FELLOWS_CENTRE_COUNT} centres on ${FELLOWS_EVENT_DATE} — invigilating, marking on site, and getting the results out the same day.`}
      />

      {/* Quick facts — the four things an applicant needs before reading further. */}
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
            a team of Fellows working alongside a Centre Lead, so the invigilating,
            marking and score-checking are shared out — you take one role, with
            people beside you doing the rest. If you are serving in Ogun State, we
            would love to have you on a centre team.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <FellowsApplyButton />
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
            team of Fellows and a Centre Lead, and you are given one clear role
            for the day.
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
            {ZONAL_CENTRES_2026.map((centre, index) => (
              <li
                key={`${centre.school}-${centre.town}`}
                className="bg-white p-5 md:p-6 flex items-start gap-4"
              >
                <span className="font-bebas text-xl text-gold-ink leading-none pt-1 shrink-0">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-medium text-foreground leading-snug">
                    {centre.school}
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
              No prior competition experience is needed, and no marking experience
              either — marking runs on our AI-powered app. You get two training
              sessions before the day, the marking scheme, and a Centre Lead to
              escalate to while you are there.
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

      {/* The three roles. The application asks which ones interest you, so the
          page has to say what they are before it asks. */}
      <section className="px-6 md:px-12 py-16 md:py-24">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 md:mb-12">
            <div className="text-xs md:text-sm font-bold tracking-widest uppercase mb-4 text-gold-ink">
              Three roles
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl leading-tight text-foreground">
              Pick What Suits You
            </h2>
            <p className="text-muted-foreground mt-4 max-w-2xl leading-relaxed">
              You tell us which roles interest you when you apply, and we assign
              one for the day. Every role is trained, and no role is done alone.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[rgba(10,15,30,0.1)] border border-[rgba(10,15,30,0.1)]">
            {ROLES.map((role) => (
              <div key={role.title} className="bg-white p-6 md:p-8">
                <h3 className="font-bebas text-xl md:text-2xl text-foreground tracking-wide mb-3">
                  {role.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">{role.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What the day gives back. */}
      <section className="bg-muted px-6 md:px-12 py-16 md:py-24">
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

      {/* How selection works. The spec adds a WhatsApp interview and compulsory
          training between applying and the day — steps an applicant has to be
          able to see before committing to any of them. */}
      <section className="bg-[#0A0F1E] px-6 md:px-12 py-14 md:py-20">
        <div className="max-w-5xl mx-auto">
          <div className="mb-10 md:mb-12">
            <div className="text-xs md:text-sm font-bold tracking-widest uppercase mb-4 text-primary">
              How selection works
            </div>
            <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl leading-tight text-white">
              From Apply<br />To The Day.
            </h2>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-6 list-none">
            {SELECTION_STEPS.map((step, index) => (
              <li key={step.title}>
                <div className="font-bebas text-sm text-primary tracking-[0.2em] mb-3">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="font-bebas text-xl md:text-2xl text-white mb-2 tracking-wide">
                  {step.title}
                </h3>
                <p className="text-sm text-[rgba(250,247,240,0.7)] leading-relaxed">
                  {step.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ. */}
      <section className="px-6 md:px-12 py-16 md:py-24">
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
            {FELLOWS_APPLICATIONS_CLOSE
              ? `Applications close on ${FELLOWS_APPLICATIONS_CLOSE}. It takes about four minutes.`
              : "Applications close once every centre is staffed, so send yours early. It takes about four minutes."}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <FellowsApplyButton />
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
