"use client";

import { useState } from "react";
import { LGA_OPTIONS, SCHOOL_CATEGORY_OPTIONS } from "@/lib/forms";
import { Button } from "../../components/ui/button";

const inputClass =
  "w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#E8A020] transition-colors text-sm";
const selectClass =
  "w-full bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-[#E8A020] transition-colors cursor-pointer appearance-none text-sm";
const labelClass =
  "block text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2";

// "Registration closed" companion: a small modal that puts a school on the
// waitlist so they're emailed the moment the next edition opens.
export default function WaitlistButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    schoolName: "",
    lga: "",
    category: "",
    contactName: "",
    contactEmail: "",
    phone: "",
  });

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const close = () => {
    setIsOpen(false);
    if (done) {
      setDone(false);
      setForm({ schoolName: "", lga: "", category: "", contactName: "", contactEmail: "", phone: "" });
    }
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to join the waitlist right now.");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join the waitlist right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button variant="default" className="mt-4" onClick={() => setIsOpen(true)}>
        Join the waitlist
      </Button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="waitlist-modal-title"
        >
          <div
            className="relative bg-[#0A0F1E] w-full max-w-lg border border-white/10 shadow-2xl p-6 md:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute top-4 right-4 text-white/60 hover:text-primary transition-colors p-1"
            >
              ✕
            </button>

            {done ? (
              <div className="text-center py-6">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#1A7A4A]/50 bg-[#1A7A4A]/15">
                  <svg className="h-8 w-8 text-[#4ADE80]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="font-bebas text-2xl text-white tracking-tight">
                  You&rsquo;re on the list
                </h4>
                <p className="mt-3 text-sm leading-relaxed text-white/60">
                  We&rsquo;ll email {form.contactEmail} the moment registration for the
                  next edition opens.
                </p>
                <Button type="button" onClick={close} className="mt-8 w-full rounded-none py-5 text-xs font-bold uppercase tracking-[0.2em]">
                  Done
                </Button>
              </div>
            ) : (
              <>
                <h3 id="waitlist-modal-title" className="font-bebas text-xl md:text-2xl text-white tracking-tight">
                  JOIN THE WAITLIST
                </h3>
                <p className="text-xs md:text-sm text-white/50 mt-1 mb-6">
                  Registration is closed — leave your details and we&rsquo;ll email you
                  the moment the next edition opens.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className={labelClass}>School Name</label>
                    <input
                      type="text"
                      required
                      value={form.schoolName}
                      onChange={(e) => set("schoolName")(e.target.value)}
                      placeholder="Full school name"
                      className={inputClass}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>School LGA</label>
                      <select value={form.lga} onChange={(e) => set("lga")(e.target.value)} className={selectClass}>
                        <option value="" className="bg-[#0A0F1E]">Select LGA</option>
                        {LGA_OPTIONS.map((lga) => (
                          <option key={lga} value={lga} className="bg-[#0A0F1E]">{lga}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Category</label>
                      <select value={form.category} onChange={(e) => set("category")(e.target.value)} className={selectClass}>
                        <option value="" className="bg-[#0A0F1E]">Select category</option>
                        {SCHOOL_CATEGORY_OPTIONS.map((c) => (
                          <option key={c} value={c} className="bg-[#0A0F1E]">{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Contact Name</label>
                      <input
                        type="text"
                        required
                        value={form.contactName}
                        onChange={(e) => set("contactName")(e.target.value)}
                        placeholder="Teacher or principal"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone (optional)</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => set("phone")(e.target.value)}
                        placeholder="080…"
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Email Address</label>
                    <input
                      type="email"
                      required
                      value={form.contactEmail}
                      onChange={(e) => set("contactEmail")(e.target.value)}
                      placeholder="you@school.edu.ng"
                      className={inputClass}
                    />
                  </div>

                  {error ? (
                    <p className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full rounded-none py-5 text-xs font-bold uppercase tracking-[0.2em]"
                  >
                    {isSubmitting ? "JOINING…" : "JOIN WAITLIST"}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
