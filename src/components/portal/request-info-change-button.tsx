"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { requestInfoChange } from "@/app/(portal)/portal/school/actions";
import type { InfoChangeResult } from "@/supabase/types";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

// Coordinator-facing "request a correction" for the school's contact details.
// An admin reviews it before it applies (like a rep replacement). Reason is
// required. Email changes are admin-only, so they're not offered here.
export default function RequestInfoChangeButton({
  registrationId,
}: {
  registrationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<InfoChangeResult | null, FormData>(
    requestInfoChange.bind(null, registrationId),
    null,
  );

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
        Request a correction
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Request a contact detail correction"
            >
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-foreground/50 cursor-default"
              />
              <div className="relative w-full max-w-md bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.2)] p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="font-bebas text-2xl text-foreground leading-tight">
                  Request a correction
                </h2>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Ask the team to fix the educator or principal name or phone number. An
                  admin reviews it before it&apos;s applied. To change an email address,
                  contact the team directly.
                </p>

                <form action={formAction} className="mt-4 space-y-3">
                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Whose details?
                    </span>
                    <select name="target" defaultValue="teacher" className={inputCls}>
                      <option value="teacher">Educator (coordinating teacher)</option>
                      <option value="principal">Principal</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Corrected full name (optional)
                    </span>
                    <input name="new_name" className={inputCls} />
                  </label>

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Corrected phone (optional)
                    </span>
                    <input name="new_phone" className={inputCls} />
                  </label>

                  <label className="block">
                    <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      Reason
                    </span>
                    <textarea name="reason" rows={2} required className={inputCls} />
                  </label>

                  {state?.error ? (
                    <p className="text-xs text-red-600">{state.error}</p>
                  ) : null}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={pending}>
                      {pending ? "Submitting…" : "Submit request"}
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
