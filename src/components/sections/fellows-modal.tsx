"use client";

import { useEffect, useState } from "react";
import {
  FELLOW_CENTRE_OPTIONS,
  FELLOW_COMMITMENTS,
  FELLOW_DECLARATIONS,
  FELLOW_GENDER_OPTIONS,
  FELLOW_ROLE_OPTIONS,
  FELLOW_SCENARIOS,
  initialFellowFormData,
  PPA_LGA_OPTIONS,
  type FellowFormData,
} from "@/lib/fellows";
import {
  FELLOWS_EVENT_DATE,
  FELLOWS_EVENT_HOURS,
  FELLOWS_SHORTLIST_BY,
  FELLOWS_WHATSAPP_NUMBER,
} from "@/lib/fellows-programme";
import { YES_NO_OPTIONS } from "@/lib/forms";
import { Button } from "../ui/button";
import {
  Field,
  inputClass,
  ResultDialog,
  SectionHeader,
  selectClass,
  type SubmitResult,
} from "./form-modal-parts";

/**
 * The NYSC Fellows application.
 *
 * Stepped rather than one long scroll: seventeen questions on a phone with no
 * visible end is where people abandon, and the progress bar plus per-step
 * validation means a mistake surfaces on the step that caused it instead of at
 * the very bottom after five minutes of typing.
 *
 * The two judgement questions in step 3 are scored on the server. Nothing here
 * knows which option is right — see `lib/fellows-scoring.ts`.
 */

type StepKey = "you" | "availability" | "judgement" | "declaration";

const STEPS: { key: StepKey; title: string; blurb?: string }[] = [
  { key: "you", title: "You & your service" },
  { key: "availability", title: "Availability & role" },
  {
    key: "judgement",
    title: "Two quick questions",
    blurb:
      "There are no trick questions here. Choose the answer closest to what you would actually do.",
  },
  { key: "declaration", title: "Declaration" },
];

const checkboxCls =
  "mt-0.5 size-4 shrink-0 cursor-pointer accent-[#E8A020]";

const radioRowCls =
  "flex cursor-pointer items-start gap-3 border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/80 transition-colors hover:border-[#E8A020]/60 has-[:checked]:border-[#E8A020] has-[:checked]:bg-[#E8A020]/10 has-[:checked]:text-white";

/**
 * One question, in its own bordered panel.
 *
 * The border is doing real work on a phone: without it a run of radio groups
 * reads as one undifferentiated wall of options, and people lose track of which
 * choices belong to which question.
 */
function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-white/15 bg-white/[0.02] p-4 md:p-5">
      <Field label={label} hint={hint}>
        {children}
      </Field>
    </div>
  );
}

/** Which fields each step owns, so validation and "can I move on?" agree. */
function validateStep(step: StepKey, data: FellowFormData): string {
  switch (step) {
    case "you":
      if (!data.fullName.trim()) return "Please enter your full name.";
      if (!data.phone.trim()) return "Please enter a phone number we can reach on WhatsApp.";
      if (!data.email.trim()) return "Please enter your email address.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim()))
        return "That email address does not look right.";
      if (!data.gender) return "Please choose an option for gender.";
      if (!data.stateCode.trim()) return "Please enter your NYSC state code.";
      if (!data.ppa.trim()) return "Please enter your Place of Primary Assignment.";
      if (!data.ppaIsSecondarySchool) return "Please say whether your PPA is a secondary school.";
      if (!data.ppaLga) return "Please choose the LGA of your PPA.";
      if (!data.courseOfStudy.trim()) return "Please enter your course of study.";
      return "";
    case "availability":
      if (data.commitments.length !== FELLOW_COMMITMENTS.length)
        return "Please confirm all three commitments — we can only post Fellows who can do the whole day and both trainings.";
      if (!data.preferredCentre) return "Please choose your preferred centre.";
      if (!data.acceptsAnotherCentre)
        return "Please say whether you would accept a different centre.";
      if (data.roles.length === 0) return "Please choose at least one role.";
      if (!data.invigilatedBefore)
        return "Please say whether you have invigilated or marked before.";
      return "";
    case "judgement":
      if (!data.scenario1 || !data.scenario2) return "Please answer both questions.";
      return "";
    case "declaration":
      if (data.declarations.length !== FELLOW_DECLARATIONS.length)
        return "Please confirm all three statements.";
      return "";
  }
}

export default function FellowsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<FellowFormData>(initialFellowFormData);
  const [stepIndex, setStepIndex] = useState(0);
  const [stepError, setStepError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const set = <K extends keyof FellowFormData>(key: K, value: FellowFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setStepError("");
  };

  const toggleInList = (key: "commitments" | "roles" | "declarations", value: string) => {
    setFormData((prev) => {
      const list = prev[key];
      return {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
    setStepError("");
  };

  const goNext = () => {
    const error = validateStep(step.key, formData);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError("");
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError("");
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const error = validateStep(step.key, formData);
    if (error) {
      setStepError(error);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/fellows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit your application right now.");
      }

      setResult({
        kind: "success",
        title: "Application received",
        message: [
          "Thank you — we have your application and a confirmation is on its way to your email.",
          FELLOWS_SHORTLIST_BY
            ? `Shortlisted Fellows are contacted on WhatsApp by ${FELLOWS_SHORTLIST_BY}.`
            : "Shortlisted Fellows are contacted on WhatsApp.",
          FELLOWS_WHATSAPP_NUMBER ? `Please save our number: ${FELLOWS_WHATSAPP_NUMBER}.` : "",
        ]
          .filter(Boolean)
          .join(" "),
      });
    } catch (submitError) {
      setResult({
        kind: "error",
        title: "Not submitted",
        message:
          submitError instanceof Error
            ? submitError.message
            : "Unable to submit your application right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResultDismiss = () => {
    const wasSuccess = result?.kind === "success";
    setResult(null);
    if (wasSuccess) {
      setFormData(initialFellowFormData);
      setStepIndex(0);
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fellows-modal-title"
    >
      <div
        className="relative bg-[#0A0F1E] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl flex flex-col shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 border-b border-white/10 shrink-0">
          <div>
            <h3
              id="fellows-modal-title"
              className="font-bebas text-xl md:text-2xl text-white tracking-tight"
            >
              APPLY TO BE A FELLOW
            </h3>
            <p className="text-xs md:text-sm text-white/50 mt-1">
              Step {stepIndex + 1} of {STEPS.length} &middot; {step.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/60 hover:text-primary transition-colors -mt-1 -mr-1 p-2 cursor-pointer"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Progress. A form with no visible end is a form people abandon. */}
        <div
          className="h-1 bg-white/10 shrink-0"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={stepIndex + 1}
          aria-label="Application progress"
        >
          <div
            className="h-full bg-[#E8A020] transition-[width] duration-300"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6">
            {step.blurb ? (
              <p className="serif-display italic text-sm md:text-base text-white/60 leading-relaxed">
                {step.blurb}
              </p>
            ) : null}

            {step.key === "you" ? (
              <>
                <SectionHeader title="About you" />

                <Question label="Full name (as on your NYSC ID card)">
                  <input
                    className={inputClass}
                    value={formData.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                    maxLength={120}
                    autoComplete="name"
                  />
                </Question>

                <Question
                  label="Phone number (WhatsApp)"
                  hint="This is how we reach you if you are shortlisted."
                >
                  <input
                    className={inputClass}
                    value={formData.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    maxLength={40}
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </Question>

                <Question label="Email address">
                  <input
                    type="email"
                    className={inputClass}
                    value={formData.email}
                    onChange={(e) => set("email", e.target.value)}
                    maxLength={320}
                    autoComplete="email"
                  />
                </Question>

                <Question label="Gender">
                  <div className="grid gap-2">
                    {FELLOW_GENDER_OPTIONS.map((option) => (
                      <label key={option} className={radioRowCls}>
                        <input
                          type="radio"
                          name="gender"
                          className={checkboxCls}
                          checked={formData.gender === option}
                          onChange={() => set("gender", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </Question>

                <SectionHeader title="Your service" />

                <Question label="NYSC state code" hint="Example: OG/26A/1234">
                  <input
                    className={inputClass}
                    value={formData.stateCode}
                    onChange={(e) => set("stateCode", e.target.value)}
                    maxLength={40}
                    placeholder="OG/26A/1234"
                  />
                </Question>

                <Question label="Place of Primary Assignment (PPA)">
                  <input
                    className={inputClass}
                    value={formData.ppa}
                    onChange={(e) => set("ppa", e.target.value)}
                    maxLength={200}
                  />
                </Question>

                <Question
                  label="Is your PPA a secondary school?"
                  hint="We ask so that we never post you to a centre where your own school is competing."
                >
                  <div className="grid grid-cols-2 gap-2">
                    {YES_NO_OPTIONS.map((option) => (
                      <label key={option} className={radioRowCls}>
                        <input
                          type="radio"
                          name="ppaIsSecondarySchool"
                          className={checkboxCls}
                          checked={formData.ppaIsSecondarySchool === option}
                          onChange={() => set("ppaIsSecondarySchool", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </Question>

                <Question label="Local Government Area of your PPA">
                  <select
                    className={selectClass}
                    value={formData.ppaLga}
                    onChange={(e) => set("ppaLga", e.target.value)}
                  >
                    <option value="" className="bg-[#0A0F1E]">
                      Select an LGA
                    </option>
                    {PPA_LGA_OPTIONS.map((lga) => (
                      <option key={lga} value={lga} className="bg-[#0A0F1E]">
                        {lga}
                      </option>
                    ))}
                  </select>
                </Question>

                <Question label="Course of study">
                  <input
                    className={inputClass}
                    value={formData.courseOfStudy}
                    onChange={(e) => set("courseOfStudy", e.target.value)}
                    maxLength={120}
                  />
                </Question>
              </>
            ) : null}

            {step.key === "availability" ? (
              <>
                <Question label="Please confirm all three">
                  <div className="grid gap-2">
                    {FELLOW_COMMITMENTS.map((commitment) => (
                      <label key={commitment} className={radioRowCls}>
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={formData.commitments.includes(commitment)}
                          onChange={() => toggleInList("commitments", commitment)}
                        />
                        {commitment}
                      </label>
                    ))}
                  </div>
                </Question>

                <Question label="Which centre would you prefer?">
                  <select
                    className={selectClass}
                    value={formData.preferredCentre}
                    onChange={(e) => set("preferredCentre", e.target.value)}
                  >
                    <option value="" className="bg-[#0A0F1E]">
                      Select a centre
                    </option>
                    {FELLOW_CENTRE_OPTIONS.map((centre) => (
                      <option key={centre} value={centre} className="bg-[#0A0F1E]">
                        {centre}
                      </option>
                    ))}
                  </select>
                </Question>

                <Question label="If posted to a different centre with transport paid, would you accept?">
                  <div className="grid grid-cols-2 gap-2">
                    {YES_NO_OPTIONS.map((option) => (
                      <label key={option} className={radioRowCls}>
                        <input
                          type="radio"
                          name="acceptsAnotherCentre"
                          className={checkboxCls}
                          checked={formData.acceptsAnotherCentre === option}
                          onChange={() => set("acceptsAnotherCentre", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </Question>

                <Question label="Which roles interest you?" hint="Choose as many as apply.">
                  <div className="grid gap-2">
                    {FELLOW_ROLE_OPTIONS.map((role) => (
                      <label key={role} className={radioRowCls}>
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={formData.roles.includes(role)}
                          onChange={() => toggleInList("roles", role)}
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </Question>

                <Question
                  label="Have you invigilated or marked an examination before?"
                  hint="Either answer is fine — training is provided."
                >
                  <div className="grid grid-cols-2 gap-2">
                    {YES_NO_OPTIONS.map((option) => (
                      <label key={option} className={radioRowCls}>
                        <input
                          type="radio"
                          name="invigilatedBefore"
                          className={checkboxCls}
                          checked={formData.invigilatedBefore === option}
                          onChange={() => set("invigilatedBefore", option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </Question>
              </>
            ) : null}

            {step.key === "judgement"
              ? FELLOW_SCENARIOS.map((scenario) => (
                  <Question key={scenario.id} label={scenario.prompt}>
                    <div className="grid gap-2">
                      {scenario.options.map((option) => (
                        <label key={option.id} className={radioRowCls}>
                          <input
                            type="radio"
                            name={scenario.id}
                            className={checkboxCls}
                            checked={formData[scenario.id] === option.id}
                            onChange={() => set(scenario.id, option.id)}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </Question>
                ))
              : null}

            {step.key === "declaration" ? (
              <>
                <Question label="Please confirm all of the following">
                  <div className="grid gap-2">
                    {FELLOW_DECLARATIONS.map((declaration) => (
                      <label key={declaration} className={radioRowCls}>
                        <input
                          type="checkbox"
                          className={checkboxCls}
                          checked={formData.declarations.includes(declaration)}
                          onChange={() => toggleInList("declarations", declaration)}
                        />
                        {declaration}
                      </label>
                    ))}
                  </div>
                </Question>
                <p className="text-[11px] leading-relaxed text-white/35">
                  Examination day is {FELLOWS_EVENT_DATE}, {FELLOWS_EVENT_HOURS}. Training
                  dates are confirmed with you if you are selected.
                </p>
              </>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-white/10 p-4 md:p-5">
            {stepError ? (
              <p
                role="alert"
                className="mb-3 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {stepError}
              </p>
            ) : null}

            <div className="flex items-center gap-3">
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  onClick={goBack}
                  className="rounded-none border border-white/20 bg-transparent px-6 py-5 text-xs font-bold uppercase tracking-[0.2em] text-white/70 hover:border-[#E8A020] hover:bg-transparent hover:text-primary"
                >
                  Back
                </Button>
              ) : null}

              {isLastStep ? (
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 rounded-none bg-[#E8A020] py-5 text-xs font-bold uppercase tracking-[0.2em] text-foreground hover:bg-white"
                >
                  {isSubmitting ? "Submitting…" : "Submit application"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={goNext}
                  className="flex-1 rounded-none bg-[#E8A020] py-5 text-xs font-bold uppercase tracking-[0.2em] text-foreground hover:bg-white"
                >
                  Continue
                </Button>
              )}
            </div>
          </div>
        </form>

        {result ? (
          <ResultDialog
            result={result}
            onDismiss={handleResultDismiss}
            labelledById="fellows-result-title"
            dismissLabel={result.kind === "success" ? "Done" : "Back to my answers"}
          />
        ) : null}
      </div>
    </div>
  );
}
