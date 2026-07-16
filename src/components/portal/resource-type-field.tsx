"use client";

import { useState } from "react";

const cls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

const OTHER = "__other__";

// Type picker for a resource: a normal dropdown (every option visible) plus an
// "Other" choice that reveals a text box for a brand-new type. Submits the
// chosen value under name="type" — a hidden input when a preset is picked, the
// text box itself when "Other" is active.
export function ResourceTypeField({
  presets,
  custom,
}: {
  presets: { value: string; label: string }[];
  custom: string[];
}) {
  const [choice, setChoice] = useState("");

  return (
    <div className="space-y-2">
      <select
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className={cls}
        aria-label="Resource type"
      >
        <option value="">Select a type…</option>
        {presets.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
        {custom.length > 0 ? (
          <optgroup label="Previously added">
            {custom.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </optgroup>
        ) : null}
        <option value={OTHER}>Other — add a new type…</option>
      </select>

      {choice === OTHER ? (
        <input
          name="type"
          autoFocus
          required
          placeholder="Type a new type, e.g. workbook"
          className={cls}
        />
      ) : (
        <input type="hidden" name="type" value={choice} />
      )}
    </div>
  );
}
