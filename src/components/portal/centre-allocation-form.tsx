"use client";

import { useActionState, type ReactNode } from "react";
import { SectionHeading } from "@/components/portal/ui";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { SubmitButton } from "@/components/portal/submit-button";

// The form shell for bulk centre allocation, split out purely to report the result.
//
// The rest of the admin reports with a `?notice=` redirect, which cannot work here:
// SettingsTabs holds the active tab in client state, so a redirect would bounce the
// admin back to the first tab and take the message with it. useActionState keeps the
// answer next to the button that caused it.
//
// The answer is a row count, not the word "saved". Pressing Save on this screen is
// most often a confirmation of choices already displayed, so a no-op is the normal
// outcome and has to be visibly distinct from work having been done.

export type CentreSaveState = { ok: boolean; message: string } | null;

export function CentreAllocationForm({
  action,
  canManage,
  children,
}: {
  action: (state: CentreSaveState, formData: FormData) => Promise<CentreSaveState>;
  canManage: boolean;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction}>
      {/* Sticky: the list runs to a couple of hundred schools, and a save button
          that has scrolled out of sight is a save button that gets forgotten. */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-background/95 py-2 backdrop-blur">
        <SectionHeading>Allocate</SectionHeading>
        {canManage ? (
          <SubmitButton size="sm" pendingText="Allocating…">
            Save all centres
          </SubmitButton>
        ) : (
          <ReadOnlyBadge />
        )}
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Saving without changing anything confirms every school&apos;s requested centre.
        Change individual schools first to move them.
      </p>
      {state ? (
        <p
          role="status"
          aria-live="polite"
          className={`mb-3 border px-3 py-2 text-xs ${
            state.ok
              ? "border-primary/30 bg-primary/5 text-foreground"
              : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
          }`}
        >
          {state.message}
        </p>
      ) : null}
      {children}
    </form>
  );
}
