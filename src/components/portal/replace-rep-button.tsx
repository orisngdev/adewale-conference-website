"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestReplacement } from "@/app/(portal)/portal/school/actions";
import type { ReplacementResult } from "@/supabase/types";
import { GENDER_OPTIONS, CLASS_OPTIONS } from "@/lib/forms";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

// Coordinator-facing "Replace" for a rep. Opens a dialog to enter the incoming
// student's details and files a request; an admin approves it before any codes
// change. Distinct from the in-place edit (that's for typo corrections).
export default function ReplaceRepButton({
  registrationId,
  name,
  level,
}: {
  registrationId: string;
  name: string;
  level: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ReplacementResult | null, FormData>(
    requestReplacement.bind(null, registrationId),
    null,
  );

  // Close on success.
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state?.ok]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Replace
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Replace ${name}`}
            >
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-foreground/50 cursor-default"
              />
              <div className="relative w-full max-w-md bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.2)] p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="font-bebas text-2xl text-foreground leading-tight">
                  Replace {name}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Enter the student taking their place. An admin reviews the request;
                  once approved, {name}&apos;s access code stops working and the new
                  student gets a fresh one.
                </p>

                <form action={formAction} className="mt-4 space-y-3">
                  <input type="hidden" name="old_name" value={name} />
                  <input type="hidden" name="old_level" value={level ?? ""} />

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      New student full name
                    </span>
                    <input name="new_name" required className={inputCls} />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Class
                      </span>
                      <select name="new_level" defaultValue={level ?? ""} className={inputCls}>
                        <option value="">—</option>
                        {CLASS_OPTIONS.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Gender
                      </span>
                      <select name="gender" defaultValue="" className={inputCls}>
                        <option value="">—</option>
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Date of birth
                    </span>
                    <input type="date" name="dob" className={inputCls} />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Guardian name
                      </span>
                      <input name="guardian_name" className={inputCls} />
                    </label>
                    <label className="block">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                        Guardian phone
                      </span>
                      <input name="guardian_number" className={inputCls} />
                    </label>
                  </div>

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Reason (optional)
                    </span>
                    <textarea name="reason" rows={2} className={inputCls} />
                  </label>

                  {state?.error ? (
                    <p className="text-xs text-red-600">{state.error}</p>
                  ) : null}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? "Submitting…" : "Request replacement"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
