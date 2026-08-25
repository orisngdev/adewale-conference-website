import type { RegistrationStatus } from "@/supabase/types";

export type RegistrationDecision = "approve" | "decline";

export interface RegistrationDecisionPatch {
  status: RegistrationStatus;
  decline_reason: string | null;
}

/** A school the review left alone, and the reason the admin needs to see. */
export interface BulkSkip {
  name: string;
  reason: string;
}

export type RegistrationDecisionOutcome =
  /** Write this patch, then send the decision email. */
  | { patch: RegistrationDecisionPatch; skipReason: null }
  /** Leave the row alone; `skipReason` is shown to the admin verbatim. */
  | { patch: null; skipReason: string };

// The close-of-registration review is re-runnable, so a bulk decision only
// writes rows that actually change state — re-approving the same selection never
// re-sends the guidelines email. Every skip carries the reason, because a bulk
// review that silently drops rows is indistinguishable from one that is broken.
//
// A declined school stays approvable: an admin who declined by mistake, or a
// school that fixed its entry, has to be selectable in the same bulk review.
// Gating approve on "submitted" alone made those rows silently no-op, leaving the
// detail page's status dropdown as the only way back. Approving clears the
// decline reason too, so the school is never left holding a stale explanation.
export function registrationDecisionOutcome(
  current: RegistrationStatus,
  decision: RegistrationDecision,
  declineReason: string | null,
): RegistrationDecisionOutcome {
  if (decision === "approve") {
    if (current === "verified") {
      return {
        patch: null,
        skipReason: "already approved — approving again would re-send the guidelines email",
      };
    }
    return { patch: { status: "verified", decline_reason: null }, skipReason: null };
  }
  if (current === "declined") {
    return {
      patch: null,
      skipReason: "already declined — declining again would re-send the not-selected email",
    };
  }
  return { patch: { status: "declined", decline_reason: declineReason }, skipReason: null };
}

export interface BulkSelectionRow {
  id: string;
  name: string;
  edition_year: number;
}

// The two reasons a selected school never even reaches the decision: its row is
// gone, or it belongs to a locked edition. Both are silent drops otherwise —
// `ids` comes from checkboxes and "select all matching", so it can outlive the
// rows it names, and the review only ever writes the current edition.
export function partitionSelection<T extends BulkSelectionRow>(input: {
  ids: string[];
  rows: T[];
  latestYear: number | null;
}): { open: T[]; skipped: BulkSkip[] } {
  const { ids, rows, latestYear } = input;
  const open: T[] = [];
  const skipped: BulkSkip[] = [];

  for (const id of ids) {
    if (!rows.some((row) => row.id === id)) {
      skipped.push({
        name: `Registration ${id.slice(0, 8)}`,
        reason: "no longer exists — it was probably deleted after this page loaded",
      });
    }
  }

  for (const row of rows) {
    if (latestYear != null && row.edition_year === latestYear) {
      open.push(row);
      continue;
    }
    skipped.push({
      name: row.name,
      reason: `it belongs to the ${row.edition_year} edition, and only ${
        latestYear ?? "the current"
      } is open for review`,
    });
  }

  return { open, skipped };
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// The headline above the per-reason breakdown. "Nothing happened" is a real
// result and has to read like one — the whole point is that a review which
// changed nothing can no longer look identical to a review that worked.
export function bulkDecisionSummary(input: {
  /** Past tense, e.g. "Approved", "Declined", "Advanced". */
  verb: string;
  appliedCount: number;
  skippedCount: number;
  selectedCount: number;
  /** Appended to the headline, e.g. "at Quarter Finals". */
  at?: string;
}): { ok: boolean; message: string } {
  const { verb, appliedCount, skippedCount, selectedCount, at } = input;
  if (appliedCount === 0) {
    return {
      ok: false,
      message: `No school changed — ${
        selectedCount === 1
          ? "the one you selected was"
          : `all ${plural(selectedCount, "school")} you selected were`
      } left exactly as before.`,
    };
  }
  const where = at ? ` at ${at}` : "";
  const rest =
    skippedCount > 0 ? `, and left ${plural(skippedCount, "school")} unchanged.` : ".";
  return { ok: true, message: `${verb} ${plural(appliedCount, "school")}${where}${rest}` };
}
