"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  initialRegistrationFormData,
  LGA_OPTIONS,
  SCHOOL_CATEGORY_OPTIONS,
  ZONAL_FINALS_OPTIONS,
  type RegistrationFormData,
} from "@/lib/forms";
import { Button } from "../../components/ui/button";

const inputClass =
  "w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#E8A020] transition-colors text-sm";

const selectClass =
  "w-full bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-[#E8A020] transition-colors cursor-pointer appearance-none text-sm disabled:cursor-not-allowed disabled:opacity-70";

const labelClass =
  "block text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2";

const NEW_SCHOOL_VALUE = "__new_school__";

interface SchoolOption {
  name: string;
  category: string;
  lga: string;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5 mt-2">
      <span className="block w-6 h-px bg-[#E8A020]" />
      <span className="font-bebas text-lg md:text-xl tracking-widest text-primary">
        {title}
      </span>
    </div>
  );
}

function StudentRepSection({
  num,
  prefix,
  formData,
  onChange,
}: {
  num: 1 | 2 | 3;
  prefix: "studentRep1" | "studentRep2" | "studentRep3";
  formData: RegistrationFormData;
  onChange: (name: keyof RegistrationFormData, value: string) => void;
}) {
  return (
    <div>
      <SectionHeader title={`Student Representative ${num}`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name">
          <input
            type="text"
            required
            value={formData[`${prefix}FullName` as keyof RegistrationFormData]}
            onChange={(e) =>
              onChange(
                `${prefix}FullName` as keyof RegistrationFormData,
                e.target.value,
              )
            }
            placeholder="Full name"
            className={inputClass}
          />
        </Field>
        <Field label="Date of Birth">
          <input
            type="date"
            required
            value={formData[`${prefix}DOB` as keyof RegistrationFormData]}
            onChange={(e) =>
              onChange(`${prefix}DOB` as keyof RegistrationFormData, e.target.value)
            }
            className={inputClass}
          />
        </Field>
        <Field label="Gender">
          <select
            required
            value={formData[`${prefix}Gender` as keyof RegistrationFormData]}
            onChange={(e) =>
              onChange(
                `${prefix}Gender` as keyof RegistrationFormData,
                e.target.value,
              )
            }
            className={selectClass}
          >
            <option value="" className="bg-[#0A0F1E]">
              Select gender
            </option>
            <option value="Male" className="bg-[#0A0F1E]">
              Male
            </option>
            <option value="Female" className="bg-[#0A0F1E]">
              Female
            </option>
          </select>
        </Field>
        <Field label="Class">
          <select
            required
            value={formData[`${prefix}Class` as keyof RegistrationFormData]}
            onChange={(e) =>
              onChange(
                `${prefix}Class` as keyof RegistrationFormData,
                e.target.value,
              )
            }
            className={selectClass}
          >
            <option value="" className="bg-[#0A0F1E]">
              Select class
            </option>
            <option value="SS 1" className="bg-[#0A0F1E]">
              SS 1
            </option>
            <option value="SS 2" className="bg-[#0A0F1E]">
              SS 2
            </option>
          </select>
        </Field>
        <Field label="Guardian Name">
          <input
            type="text"
            required
            value={formData[`${prefix}GuardianName` as keyof RegistrationFormData]}
            onChange={(e) =>
              onChange(
                `${prefix}GuardianName` as keyof RegistrationFormData,
                e.target.value,
              )
            }
            placeholder="Guardian's full name"
            className={inputClass}
          />
        </Field>
        <Field label="Guardian Number">
          <input
            type="tel"
            required
            value={formData[`${prefix}GuardianNumber` as keyof RegistrationFormData]}
            onChange={(e) =>
              onChange(
                `${prefix}GuardianNumber` as keyof RegistrationFormData,
                e.target.value,
              )
            }
            placeholder="+234 _"
            className={inputClass}
          />
        </Field>
      </div>
    </div>
  );
}

interface RegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RegistrationModal({
  isOpen,
  onClose,
}: RegistrationModalProps) {
  const [formData, setFormData] = useState<RegistrationFormData>(
    initialRegistrationFormData,
  );
  const [schoolSelection, setSchoolSelection] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<SchoolOption[]>([]);
  const [isLoadingSchools, setIsLoadingSchools] = useState(false);
  const [schoolLookupError, setSchoolLookupError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

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

  useEffect(() => {
    if (!isOpen || !formData.schoolLGA || !formData.schoolCategory) {
      setSchoolOptions([]);
      setIsLoadingSchools(false);
      setSchoolLookupError("");
      return;
    }

    const controller = new AbortController();

    const lookupSchools = async () => {
      setIsLoadingSchools(true);
      setSchoolLookupError("");

      try {
        const params = new URLSearchParams({
          lga: formData.schoolLGA,
          category: formData.schoolCategory,
        });
        const response = await fetch(`/api/schools?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as
          | { error?: string; schools?: SchoolOption[] }
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load schools right now.");
        }

        setSchoolOptions(payload?.schools ?? []);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setSchoolOptions([]);
        setSchoolLookupError(
          error instanceof Error
            ? error.message
            : "Unable to load schools right now.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingSchools(false);
        }
      }
    };

    void lookupSchools();

    return () => controller.abort();
  }, [formData.schoolCategory, formData.schoolLGA, isOpen]);

  if (!isOpen) return null;

  const handleChange = (name: keyof RegistrationFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLGAChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      schoolLGA: value,
      schoolSource: "existing",
      schoolFullName: "",
    }));
    setSchoolSelection("");
  };

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      schoolCategory: value,
      schoolSource: "existing",
      schoolFullName: "",
    }));
    setSchoolSelection("");
  };

  const handleSchoolSelection = (value: string) => {
    setSchoolSelection(value);
    setFormData((prev) => ({
      ...prev,
      schoolSource: value === NEW_SCHOOL_VALUE ? "new" : "existing",
      schoolFullName: value === NEW_SCHOOL_VALUE ? "" : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await fetch("/api/registration", {
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
        throw new Error(payload?.error || "Unable to submit registration right now.");
      }

      setSubmitted(true);
      toast.success("Registration submitted successfully.");

      setTimeout(() => {
        setSubmitted(false);
        setFormData(initialRegistrationFormData);
        setSchoolSelection("");
        setSchoolOptions([]);
        setSchoolLookupError("");
        setSubmitError("");
        onClose();
      }, 2000);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to submit registration right now.";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const showSchoolSelect = formData.schoolLGA && formData.schoolCategory;
  const isNewSchool = schoolSelection === NEW_SCHOOL_VALUE;
  const isRegisteredSchoolSelected =
    schoolSelection !== "" && schoolSelection !== NEW_SCHOOL_VALUE;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4 md:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="registration-modal-title"
    >
      <div
        className="relative bg-[#0A0F1E] w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl flex flex-col shadow-2xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-4 md:p-4 border-b border-white/10 shrink-0">
          <div>
            <h3
              id="registration-modal-title"
              className="font-bebas text-xl md:text-2xl text-white tracking-tight"
            >
              REGISTER YOUR SCHOOL
            </h3>
            <p className="text-xs md:text-sm text-white/50 mt-1">
              Complete all fields. We&apos;ll confirm your registration within 48
              hours.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/60 hover:text-primary transition-colors -mt-1 -mr-1 p-2"
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

        <form
          id="registration-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 md:px-8 py-6 space-y-8 scrollbar-none [&::-webkit-scrollbar]:hidden"
        >
          <div>
            <SectionHeader title="School Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="School LGA">
                <select
                  required
                  value={formData.schoolLGA}
                  onChange={(e) => handleLGAChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#0A0F1E]">
                    Select LGA
                  </option>
                  {LGA_OPTIONS.map((lga) => (
                    <option key={lga} value={lga} className="bg-[#0A0F1E]">
                      {lga}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="School Category">
                <select
                  required
                  value={formData.schoolCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#0A0F1E]">
                    Select category
                  </option>
                  {SCHOOL_CATEGORY_OPTIONS.map((category) => (
                    <option key={category} value={category} className="bg-[#0A0F1E]">
                      {category}
                    </option>
                  ))}
                </select>
              </Field>

              {showSchoolSelect ? (
                <div className="sm:col-span-2">
                  <Field label="Select Your School">
                    <select
                      required
                      value={schoolSelection}
                      onChange={(e) => handleSchoolSelection(e.target.value)}
                      className={selectClass}
                      disabled={isLoadingSchools}
                    >
                      <option value="" className="bg-[#0A0F1E]">
                        {isLoadingSchools
                          ? "Loading schools..."
                          : schoolOptions.length > 0
                            ? "Choose your school"
                            : "No registered schools match - pick the option below"}
                      </option>
                      {schoolOptions.map((school) => (
                        <option
                          key={school.name}
                          value={school.name}
                          className="bg-[#0A0F1E]"
                        >
                          {school.name}
                        </option>
                      ))}
                      <option value={NEW_SCHOOL_VALUE} className="bg-[#0A0F1E]">
                        My school isn&apos;t listed here
                      </option>
                    </select>
                  </Field>
                  {schoolLookupError ? (
                    <p className="mt-3 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                      {schoolLookupError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {isRegisteredSchoolSelected ? (
                <div className="sm:col-span-2 border border-[#E8A020]/30 bg-[#E8A020]/5 px-4 py-3">
                  <span className="block text-[10px] font-bold tracking-widest uppercase text-primary/80 mb-1">
                    Registered School
                  </span>
                  <p className="text-white font-medium text-sm md:text-base">
                    {schoolSelection}
                  </p>
                </div>
              ) : null}

              {isNewSchool ? (
                <div className="sm:col-span-2">
                  <Field label="School Full Name">
                    <input
                      type="text"
                      required
                      value={formData.schoolFullName}
                      onChange={(e) =>
                        handleChange("schoolFullName", e.target.value)
                      }
                      placeholder="Enter your school's full name"
                      className={inputClass}
                    />
                  </Field>
                </div>
              ) : null}

              <Field label="School Email Address">
                <input
                  type="email"
                  value={formData.schoolEmail}
                  onChange={(e) => handleChange("schoolEmail", e.target.value)}
                  placeholder="school@example.com (optional)"
                  className={inputClass}
                />
              </Field>
              <Field label="School Address">
                <input
                  type="text"
                  required
                  value={formData.schoolAddress}
                  onChange={(e) => handleChange("schoolAddress", e.target.value)}
                  placeholder="Full school address"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="How Did You Hear About Adewale?">
                  <input
                    type="text"
                    required
                    value={formData.hearAboutAdewale}
                    onChange={(e) =>
                      handleChange("hearAboutAdewale", e.target.value)
                    }
                    placeholder="e.g. friend, social media, previous edition"
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>
          </div>

          <div>
            <SectionHeader title="Zonal Finals" />
            <div className="grid grid-cols-1 gap-4">
              <Field label="Select Location For Zonal Finals">
                <select
                  required
                  value={formData.zonalFinalsLocation}
                  onChange={(e) =>
                    handleChange("zonalFinalsLocation", e.target.value)
                  }
                  className={selectClass}
                >
                  <option value="" className="bg-[#0A0F1E]">
                    Select a location
                  </option>
                  {ZONAL_FINALS_OPTIONS.map((location) => (
                    <option key={location} value={location} className="bg-[#0A0F1E]">
                      {location}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <StudentRepSection
            num={1}
            prefix="studentRep1"
            formData={formData}
            onChange={handleChange}
          />
          <StudentRepSection
            num={2}
            prefix="studentRep2"
            formData={formData}
            onChange={handleChange}
          />
          <StudentRepSection
            num={3}
            prefix="studentRep3"
            formData={formData}
            onChange={handleChange}
          />

          <div>
            <SectionHeader title="Principal Information" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Principal Full Name">
                <input
                  type="text"
                  required
                  value={formData.principalFullName}
                  onChange={(e) => handleChange("principalFullName", e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                />
              </Field>
              <Field label="Principal Gender">
                <select
                  required
                  value={formData.principalGender}
                  onChange={(e) => handleChange("principalGender", e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#0A0F1E]">
                    Select gender
                  </option>
                  <option value="Male" className="bg-[#0A0F1E]">
                    Male
                  </option>
                  <option value="Female" className="bg-[#0A0F1E]">
                    Female
                  </option>
                </select>
              </Field>
              <Field label="Principal Number">
                <input
                  type="tel"
                  required
                  value={formData.principalNumber}
                  onChange={(e) => handleChange("principalNumber", e.target.value)}
                  placeholder="+234 _"
                  className={inputClass}
                />
              </Field>
              <Field label="Principal Email Address">
                <input
                  type="email"
                  required
                  value={formData.principalEmail}
                  onChange={(e) => handleChange("principalEmail", e.target.value)}
                  placeholder="principal@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeader title="Supervising Teacher" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Teacher Full Name">
                <input
                  type="text"
                  required
                  value={formData.teacherFullName}
                  onChange={(e) => handleChange("teacherFullName", e.target.value)}
                  placeholder="Full name"
                  className={inputClass}
                />
              </Field>
              <Field label="Teacher Gender">
                <select
                  required
                  value={formData.teacherGender}
                  onChange={(e) => handleChange("teacherGender", e.target.value)}
                  className={selectClass}
                >
                  <option value="" className="bg-[#0A0F1E]">
                    Select gender
                  </option>
                  <option value="Male" className="bg-[#0A0F1E]">
                    Male
                  </option>
                  <option value="Female" className="bg-[#0A0F1E]">
                    Female
                  </option>
                </select>
              </Field>
              <Field label="Teacher Number">
                <input
                  type="tel"
                  required
                  value={formData.teacherNumber}
                  onChange={(e) => handleChange("teacherNumber", e.target.value)}
                  placeholder="+234 _"
                  className={inputClass}
                />
              </Field>
              <Field label="Teacher Email Address">
                <input
                  type="email"
                  required
                  value={formData.teacherEmail}
                  onChange={(e) => handleChange("teacherEmail", e.target.value)}
                  placeholder="teacher@example.com"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div>
            <SectionHeader title="Past Edition" />
            <div className="grid grid-cols-1 gap-4">
              <Field label="Did Your School Participate In The Last Edition?">
                <select
                  required
                  value={formData.participatedLastEdition}
                  onChange={(e) =>
                    handleChange("participatedLastEdition", e.target.value)
                  }
                  className={selectClass}
                >
                  <option value="" className="bg-[#0A0F1E]">
                    Select an option
                  </option>
                  <option value="Yes" className="bg-[#0A0F1E]">
                    Yes
                  </option>
                  <option value="No" className="bg-[#0A0F1E]">
                    No
                  </option>
                </select>
              </Field>
              <Field label="What Did You Like About The Last Edition?">
                <input
                  type="text"
                  value={formData.likesAboutLastEdition}
                  onChange={(e) =>
                    handleChange("likesAboutLastEdition", e.target.value)
                  }
                  placeholder="Share your favourite moments"
                  className={inputClass}
                />
              </Field>
              <Field label="What Are Your Expectations For This Edition?">
                <input
                  type="text"
                  value={formData.expectationFromLastEdition}
                  onChange={(e) =>
                    handleChange("expectationFromLastEdition", e.target.value)
                  }
                  placeholder="Tell us what you're hoping for"
                  className={inputClass}
                />
              </Field>
            </div>
          </div>
        </form>

        <div className="border-t border-white/10 p-4 md:p-4 shrink-0 bg-[#0A0F1E]">
          {submitError ? (
            <p className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {submitError}
            </p>
          ) : null}
          <Button
            type="submit"
            form="registration-form"
            disabled={submitted || isSubmitting}
            className={`w-full py-5 rounded-none font-bold text-xs tracking-[0.2em] uppercase transition-all duration-300 ${
              submitted
                ? "bg-[#1A7A4A] text-white hover:bg-[#1A7A4A]"
                : "bg-[#E8A020] text-foreground hover:bg-white"
            }`}
          >
            {submitted
              ? "REGISTRATION SUBMITTED"
              : isSubmitting
                ? "SUBMITTING..."
                : "SUBMIT REGISTRATION"}
          </Button>
          <p className="text-[10px] text-white/30 text-center mt-4 leading-relaxed">
            By submitting, you confirm that the information provided is accurate
            to the best of your knowledge.
          </p>
        </div>
      </div>
    </div>
  );
}
