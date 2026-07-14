"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LGA_OPTIONS, SCHOOL_CATEGORY_OPTIONS } from "@/lib/forms";
import {
  requestSchoolAccess,
  type RequestAccessResult,
} from "@/app/(portal)/portal/claim/actions";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60";

interface SchoolOption {
  id: string;
  name: string;
}

// "No claim code" path: LGA + category narrow the school list (same lookup
// the registration form uses), then the request lands in the admin queue.
export default function RequestAccessForm() {
  const [lga, setLga] = useState("");
  const [category, setCategory] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<RequestAccessResult | null>(null);

  useEffect(() => {
    setSchoolId("");
    if (!lga || !category) {
      setSchools([]);
      return;
    }
    const controller = new AbortController();
    (async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ lga, category });
        const response = await fetch(`/api/schools?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | { schools?: SchoolOption[] }
          | null;
        setSchools(payload?.schools ?? []);
      } catch {
        if (!controller.signal.aborted) setSchools([]);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    })();
    return () => controller.abort();
  }, [lga, category]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setResult(await requestSchoolAccess(schoolId));
    setIsSubmitting(false);
  };

  if (result && "status" in result) {
    return (
      <p className="text-sm text-foreground">
        {result.status === "approved"
          ? "You already have access to this school — open “My school” from the sidebar."
          : "Request sent. An admin will review it — you'll get a notification once you're approved."}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <select
          value={lga}
          onChange={(e) => setLga(e.target.value)}
          className={inputCls}
          required
        >
          <option value="">School LGA</option>
          {LGA_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputCls}
          required
        >
          <option value="">Category</option>
          {SCHOOL_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
      <select
        value={schoolId}
        onChange={(e) => setSchoolId(e.target.value)}
        className={inputCls}
        required
        disabled={!schools.length}
      >
        <option value="">
          {isLoading
            ? "Loading schools…"
            : schools.length
              ? "Select your school"
              : "Pick LGA and category first"}
        </option>
        {schools.map((school) => (
          <option key={school.id} value={school.id}>
            {school.name}
          </option>
        ))}
      </select>

      {result && "error" in result ? (
        <p className="text-sm text-red-600">{result.error}</p>
      ) : null}

      <Button type="submit" size="sm" disabled={isSubmitting || !schoolId}>
        {isSubmitting ? "Sending…" : "Request access"}
      </Button>
    </form>
  );
}
