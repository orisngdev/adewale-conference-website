"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  initialSponsorshipFormData,
  SPONSORSHIP_TIER_OPTIONS,
  type SponsorshipFormData,
} from "@/lib/forms";

const sponsorTiers = [
  {
    badge: "PLATINUM",
    name: "Headline Sponsor",
    desc: "Title naming rights, keynote slot, full branding",
    amount: "NGN 10M+",
  },
  {
    badge: "GOLD",
    name: "Category Sponsor",
    desc: "Category naming rights, branded stage, shortlist access",
    amount: "NGN 5M",
  },
  {
    badge: "SILVER",
    name: "Programme Sponsor",
    desc: "Logo prominence, branded materials, VIP presence",
    amount: "NGN 2.5M",
  },
  {
    badge: "BRONZE",
    name: "Community Partner",
    desc: "Brand recognition, event listing, impact report",
    amount: "NGN 1M",
  },
  {
    badge: "SCHOLAR",
    name: "Scholarship Sponsor",
    desc: "Fund named scholarships with full attribution",
    amount: "From\nNGN 500K",
  },
] as const;

export default function SponsorshipSection() {
  const [formData, setFormData] = useState<SponsorshipFormData>(
    initialSponsorshipFormData,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/sponsorship", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          payload?.error || "Unable to send sponsorship enquiry right now.",
        );
      }

      setSubmitted(true);
      setFormData(initialSponsorshipFormData);
      setSubmitError("");
      toast.success("Sponsorship enquiry sent successfully.");
      setTimeout(() => setSubmitted(false), 2000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to send sponsorship enquiry right now.";
      setSubmitError(message);
      toast.error(
        message,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="partner" className="bg-[#E8A020] py-14 md:py-16 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 md:gap-20 items-start">
          <div className="space-y-10">
            <div>
              <div className="text-sm font-bold tracking-[0.2em] uppercase text-foreground mb-2">
                Sponsorship
              </div>
              <h2 className="font-bebas text-5xl md:text-7xl text-foreground mb-8 leading-[0.95]">
                INVEST IN OGUN STATE'S
                <br />
                FUTURE.
              </h2>
              <p className="text-base md:text-lg text-foreground opacity-90 max-w-lg leading-relaxed">
                ASC 2026 is our most significant edition yet. We seek partners
                who believe investing in young people is the highest return
                investment any organisation can make.
              </p>
            </div>

            <div className="space-y-2">
              {sponsorTiers.map((tier) => (
                <div
                  key={tier.badge}
                  className="bg-[rgba(10,15,30,0.05)] p-5 md:p-6 flex items-center justify-between group transition-colors hover:bg-white/20"
                >
                  <div className="flex items-center gap-6">
                    <div className="font-bebas text-[11px] tracking-widest bg-[#0A0F1E] text-primary px-4 py-2 min-w-[100px] text-center">
                      {tier.badge}
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground text-sm mb-1">
                        {tier.name}
                      </h3>
                      <p className="text-[11px] text-foreground opacity-60 leading-tight">
                        {tier.desc}
                      </p>
                    </div>
                  </div>
                  <div className="font-bebas text-xl md:text-2xl text-foreground whitespace-pre-line ml-4">
                    {tier.amount}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0A0F1E] p-8 md:p-14 shadow-2xl">
            <h3 className="font-bebas text-3xl text-white mb-2 tracking-tight">
              EXPRESS YOUR INTEREST
            </h3>
            <p className="text-sm text-white opacity-50 mb-10">
              Our team will reach out within 48 hours with a full sponsorship
              deck.
            </p>

            <form onSubmit={handleSubmit} className="space-y-7">
              {[
                {
                  label: "Organisation Name",
                  name: "org",
                  placeholder: "e.g. Dangote Industries Ltd",
                  type: "text",
                },
                {
                  label: "Contact Person",
                  name: "contact",
                  placeholder: "Full name",
                  type: "text",
                },
                {
                  label: "Email Address",
                  name: "email",
                  placeholder: "csr@yourcompany.com",
                  type: "email",
                },
                {
                  label: "Phone Number",
                  name: "phone",
                  placeholder: "+234 _",
                  type: "tel",
                },
                {
                  label: "Message (Optional)",
                  name: "message",
                  placeholder: "Any specific areas of interest or questions.....",
                  type: "text",
                  required: false,
                },
              ].map((field) => (
                <div key={field.name} className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-white opacity-40">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    name={field.name}
                    value={formData[field.name as keyof SponsorshipFormData]}
                    required={field.required !== false}
                    onChange={handleChange}
                    placeholder={field.placeholder}
                    className="w-full bg-white/5 border border-white/10 px-4 py-4 text-white placeholder-white opacity-30 outline-none focus:border-[#E8A020] focus:opacity-100 transition-all text-sm"
                  />
                </div>
              ))}

              <div className="space-y-2">
                <label className="text-[10px] font-bold tracking-widest uppercase text-white opacity-40">
                  Sponsorship Tier of Interest
                </label>
                <div className="relative">
                  <select
                    name="tier"
                    required
                    value={formData.tier}
                    onChange={handleChange}
                    className="w-full bg-white/5 border border-white/10 px-4 py-4 text-white outline-none focus:border-[#E8A020] transition-colors cursor-pointer appearance-none text-sm"
                  >
                    <option value="" className="bg-[#0A0F1E]">
                      Select a tier
                    </option>
                    {SPONSORSHIP_TIER_OPTIONS.map((tier) => (
                      <option key={tier} value={tier} className="bg-[#0A0F1E]">
                        {tier}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-white opacity-60">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                {submitError ? (
                  <p className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {submitError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={submitted || isSubmitting}
                  className={`w-full py-5 font-bold text-xs tracking-[0.2em] uppercase transition-all duration-300 ${
                    submitted
                      ? "bg-[#1A7A4A] text-white"
                      : "bg-[#E8A020] text-foreground hover:bg-white"
                  }`}
                >
                  {submitted
                    ? "ENQUIRY SENT"
                    : isSubmitting
                      ? "SENDING..."
                      : "SEND SPONSORSHIP ENQUIRY"}
                </button>

                <p className="text-[10px] text-white opacity-30 text-center mt-6 leading-relaxed">
                  Your information is handled in confidence and will only be used
                  to respond to your enquiry.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
