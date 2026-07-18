"use client";

import { useState } from "react";
import {
  AUTHORABLE_TYPES,
  CHALLENGE_TYPE_GLYPH,
  CHALLENGE_TYPE_HINT,
  CHALLENGE_TYPE_LABEL,
  type ChallengeType,
} from "@/lib/challenges";

// Type picker for the admin create/edit form. Renders a hidden input so the
// choice posts with the form. Data is shown but disabled — data challenges are
// authored separately (they need a hidden ground-truth set), so they can't be
// created here.
export function ChallengeTypePicker({
  name = "type",
  defaultValue = "pitch",
}: {
  name?: string;
  defaultValue?: ChallengeType;
}) {
  const [selected, setSelected] = useState<ChallengeType>(
    AUTHORABLE_TYPES.includes(defaultValue) ? defaultValue : "pitch",
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selected} />
      <div className="flex flex-wrap gap-2">
        {AUTHORABLE_TYPES.map((t) => {
          const on = t === selected;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setSelected(t)}
              aria-pressed={on}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide transition-colors ${
                on
                  ? "border-primary bg-primary/[0.14] text-gold-ink"
                  : "border-foreground/15 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span aria-hidden>{CHALLENGE_TYPE_GLYPH[t]}</span> {CHALLENGE_TYPE_LABEL[t]}
            </button>
          );
        })}
        <span
          title="Data challenges are authored separately — they need a hidden ground-truth set."
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-foreground/15 px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground opacity-45"
        >
          <span aria-hidden>{CHALLENGE_TYPE_GLYPH.data}</span> {CHALLENGE_TYPE_LABEL.data}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{CHALLENGE_TYPE_HINT[selected]}</p>
    </div>
  );
}
