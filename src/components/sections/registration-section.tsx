import { Button } from "../../components/ui/button";
import RegisterSchoolButton from "./register-school-button";

const eligibilityItems = [
  "Open to all public and private secondary schools in Ogun State",
  "STEM Contest: SS1 and SS2 students only (up to 3 students per school team)",
  " It is compulsory to have at least one female student on the team, except for single-gender schools. ",
  "Innovation Pitch: Any student with a problem worth solving",
  "Schools must have a supervising teacher registered with the team",
  "Registration is free — no entry fees for any category",
  "Registration deadline: May 31st 2026. No exceptions.",
];

const steps = [
  {
    num: "1",
    title: "Complete the Online Form",
    desc: "Fill in your school details, student names, and supervising teacher information via our registration form. Takes under 10 minutes.",
  },
  {
    num: "2",
    title: "Receive Confirmation",
    desc: "You'll receive an email confirmation after application review at close of registration with the full competition guidelines.",
  },
  {
    num: "3",
    title: "Prepare for Zonals",
    desc: "The zonal stage runs June – July. Your supervising teacher will be sent the schedule at least 2 weeks in advance.",
  },
  {
    num: "4",
    title: "Compete at the Grand Finale",
    desc: "Qualifying schools advance to the October Grand Finale. Feeding and accommodation for students are covered by the programme.",
  },
];

export default function RegistrationSection() {
  return (
    <section id="register" className="bg-[#0A0F1E] py-14 md:py-16 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-16">
          <div>
            <div className="mb-8 md:mb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="block w-6 h-px bg-[#E8A020]" />
                <span className="text-xs font-bold tracking-[0.3em] uppercase text-primary">
                  For Schools
                </span>
              </div>
              <h2 className="font-bebas text-3xl md:text-4xl lg:text-5xl leading-[0.95] text-white">
                Is Your School <br /> Ready?
              </h2>
            </div>

            <p className="text-base md:text-lg text-[rgba(250,247,240,0.65)] leading-relaxed mb-12">
              Registration for ASC 2026 opens May 1st. Every secondary school in Ogun State is eligible. The competition is free to enter. The opportunity is unlimited.
            </p>

            <div className="bg-[#1C2540] p-8 md:p-10 mb-12">
              <h3 className="text-lg md:text-xl font-medium text-white mb-6">
                Eligibility & Requirements
              </h3>
              <ul className="space-y-4">
                {eligibilityItems.map((item, idx) => (
                  <li key={idx} className="flex gap-4 text-sm md:text-base text-[rgba(250,247,240,0.65)]">
                    <span className="text-primary font-bold flex-shrink-0">✦</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-2xl md:text-3xl font-bebas text-white mb-10">
              How to Register
            </h3>

            <div className="space-y-6 mb-12">
              {steps.map((step) => (
                <div key={step.num} className="flex gap-6">
                  <div className="w-12 h-12 rounded-full bg-[#E8A020] flex items-center justify-center flex-shrink-0">
                    <span className="font-bebas text-lg text-foreground">{step.num}</span>
                  </div>
                  <div>
                    <h4 className="text-lg md:text-xl font-medium text-white mb-2">
                      {step.title}
                    </h4>
                    <p className="text-sm md:text-base text-[rgba(250,247,240,0.65)]">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4">
              <RegisterSchoolButton />
              <Button variant="secondary" className="py-6" asChild>
                <a href="mailto:adewaleconference@gmail.com?subject=ASC%202026%20Registration%20Question">
                  Have a question? Email Us
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
