"use client";

import { useState } from "react";

// "Select all N matching" across every page of a paginated list — not just the
// rendered rows. Injects a hidden `ids` input per matching id into the bulk
// form so the server action receives the full set. The overlap with any ticked
// page rows is deduped server-side.
export function SelectAllMatching({
  formId,
  ids,
}: {
  formId: string;
  ids: string[];
}) {
  const [on, setOn] = useState(false);
  const MARK = "data-all-matching";

  const apply = (checked: boolean) => {
    setOn(checked);
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    // Clear any previously injected inputs before (re)applying.
    form.querySelectorAll(`input[${MARK}]`).forEach((el) => el.remove());
    if (checked) {
      for (const id of ids) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "ids";
        input.value = id;
        input.setAttribute(MARK, "");
        form.appendChild(input);
      }
    }
    // Reflect the choice on the visible page checkboxes.
    document
      .querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="ids"][form="${formId}"]`,
      )
      .forEach((box) => {
        box.checked = checked;
      });
  };

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={on}
        aria-label={`Select all ${ids.length} matching entries across pages`}
        onChange={(e) => apply(e.currentTarget.checked)}
      />
      Select all {ids.length} matching
    </label>
  );
}
