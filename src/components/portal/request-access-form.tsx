"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchSelect } from "@/components/ui/search-select";
import { LGA_OPTIONS, SCHOOL_CATEGORY_OPTIONS } from "@/lib/forms";
import {
  requestSchoolAccess,
  type RequestAccessResult,
} from "@/app/(portal)/portal/claim/actions";

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
        <SearchSelect
          value={lga}
          onValueChange={setLga}
          options={LGA_OPTIONS.map((option) => ({ value: option, label: option }))}
          placeholder="School LGA"
          searchPlaceholder="Search LGAs…"
          aria-label="School LGA"
        />
        <Select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full"
          required
        >
          <option value="">Category</option>
          {SCHOOL_CATEGORY_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>
      {/* 500+ schools statewide, so this one has to be typed into rather than scrolled. */}
      <SearchSelect
        value={schoolId}
        onValueChange={setSchoolId}
        options={schools.map((school) => ({ value: school.id, label: school.name }))}
        disabled={!schools.length}
        placeholder={
          isLoading
            ? "Loading schools…"
            : schools.length
              ? "Select your school"
              : "Pick LGA and category first"
        }
        searchPlaceholder="Search your school by name…"
        emptyMessage="No school matches that name"
        aria-label="School"
      />

      {result && "error" in result ? (
        <p className="text-sm text-red-600">{result.error}</p>
      ) : null}

      <Button type="submit" size="sm" disabled={isSubmitting || !schoolId}>
        {isSubmitting ? "Sending…" : "Request access"}
      </Button>
    </form>
  );
}
