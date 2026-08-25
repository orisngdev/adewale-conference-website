"use client";

import { useActionState } from "react";
import { CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/portal/ui";
import { ConfirmDecisionButton } from "@/components/portal/confirm-decision-button";
import { SelectAllCheckbox } from "@/components/portal/select-all-checkbox";
import { SelectAllMatching } from "@/components/portal/select-all-matching";
import {
  bulkRegistrationDecision,
  type BulkDecisionState,
} from "@/app/(portal)/portal/admin/actions";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-2 text-sm outline-none focus:border-primary";

// How many school names to spell out per skip reason before collapsing the rest
// into a count — a "select all matching" run can skip hundreds of rows.
const NAMES_SHOWN = 8;

// Close-of-registration review. A client component because the review has to
// report back: the action skips any row that would only re-send an email, and a
// bulk submit that silently changed nothing is indistinguishable from a broken
// button. Every skipped school comes back with its reason and is shown here.
export function BulkDecisionForm({
  formId,
  underReview,
  matchCount,
  matchingIds,
}: {
  formId: string;
  underReview: number;
  matchCount: number;
  /** Ids across every page, for "select all matching" — null when one page holds them all. */
  matchingIds: string[] | null;
}) {
  const [state, formAction] = useActionState<BulkDecisionState, FormData>(
    bulkRegistrationDecision,
    null,
  );

  return (
    <form id={formId} action={formAction}>
      <Card className="p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SelectAllCheckbox formId={formId} targetName="ids" />
          {matchingIds ? <SelectAllMatching formId={formId} ids={matchingIds} /> : null}
          <p className="text-sm text-muted-foreground flex-1 min-w-40">
            <span className="font-bold text-foreground">{underReview}</span> under review ·{" "}
            <span className="font-bold text-foreground">{matchCount}</span>{" "}
            match{matchCount === 1 ? "" : "es"} — select schools below, then:
          </p>
          <ConfirmDecisionButton
            name="decision"
            value="approve"
            size="sm"
            title="Approve selected schools?"
            description="Every ticked school enters the competition, moves to Participants at Qualifications, receives the guidelines email, and gets its competition roster. A school you declined earlier can be approved here — that clears the decline reason it was shown."
            confirmLabel="Yes, approve"
          >
            Approve and move to Participants
          </ConfirmDecisionButton>
          <ConfirmDecisionButton
            name="decision"
            value="decline"
            size="sm"
            variant="outline"
            destructive
            title="Decline selected schools?"
            description="Every ticked school is declined and sent a polite not-selected email. If you enter a reason below, it's included in that email and shown on their portal so they can fix it and resubmit."
            confirmLabel="Yes, decline"
          >
            Decline selected
          </ConfirmDecisionButton>
        </div>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Decline reason (optional)
          </span>
          <input
            name="decline_reason"
            placeholder="Shared with every declined school, e.g. No female representative."
            className={`${inputCls} mt-1 w-full`}
          />
        </label>

        {state ? <DecisionReport state={state} /> : null}
      </Card>
    </form>
  );
}

function DecisionReport({ state }: { state: NonNullable<BulkDecisionState> }) {
  // One line per reason, so "12 skipped" is never the whole story.
  const byReason = new Map<string, string[]>();
  for (const { name, reason } of state.skipped) {
    byReason.set(reason, [...(byReason.get(reason) ?? []), name]);
  }

  return (
    <div
      role={state.ok ? "status" : "alert"}
      aria-live="polite"
      className={`border p-3 text-sm ${
        state.ok
          ? "border-green-600/30 bg-green-600/10"
          : "border-amber-500/40 bg-amber-500/10"
      }`}
    >
      <p className="flex items-start gap-2 font-medium text-foreground">
        {state.ok ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-700" />
        ) : (
          <Info className="mt-0.5 size-4 shrink-0 text-amber-700" />
        )}
        <span>{state.message}</span>
      </p>

      {byReason.size > 0 ? (
        <ul className="mt-2 space-y-1.5 text-muted-foreground">
          {[...byReason].map(([reason, names]) => (
            <li key={reason}>
              <span className="font-medium text-foreground">
                {names.length} {names.length === 1 ? "school" : "schools"}
              </span>{" "}
              — {reason}:{" "}
              <span className="text-foreground/80">
                {names.slice(0, NAMES_SHOWN).join(", ")}
                {names.length > NAMES_SHOWN
                  ? ` and ${names.length - NAMES_SHOWN} more`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
