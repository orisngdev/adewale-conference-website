"use client";

import { useState } from "react";
import { ZONAL_FINALS_OPTIONS } from "@/lib/forms";

// Centre picker with an explicit escape hatch.
//
// The eight centres in ZONAL_FINALS_OPTIONS are hardcoded, so a centre opened
// mid-season has no way into the list without a code change. The text box covers
// that — but it only appears once you have deliberately chosen "Not allocated",
// because a free-text centre field left open by default is what filled this column
// with LGAs and division names in the first place. Anything typed here is stored as
// given and labelled "not a centre" wherever it is displayed, so it stays visibly
// non-standard instead of blending in with a real allocation.
//
// Used by both the bulk Centres screen and the per-school control on Qualifications,
// so the two cannot drift into disagreeing about what a valid centre is.

const selectCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-1 text-xs outline-none focus:border-primary " +
  "disabled:cursor-not-allowed disabled:bg-foreground/5 disabled:text-muted-foreground";

export function CentrePicker({
  label,
  name,
  otherName,
  defaultValue,
  defaultOther,
  disabled,
}: {
  /** Who this picker is for — the school name, used for the accessible name since
   *  the visible label is the row heading rather than a <label> element. */
  label: string;
  /** Field name for the dropdown. */
  name: string;
  /** Field name for the free-text fallback; only submitted when the dropdown is empty. */
  otherName: string;
  defaultValue: string;
  defaultOther: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        aria-label={`Exam centre for ${label}`}
        className={selectCls}
      >
        <option value="">Not allocated…</option>
        {ZONAL_FINALS_OPTIONS.map((centre) => (
          <option key={centre} value={centre}>
            {centre}
          </option>
        ))}
      </select>
      {value === "" ? (
        <input
          name={otherName}
          defaultValue={defaultOther}
          disabled={disabled}
          maxLength={80}
          placeholder="Or type a centre"
          aria-label={`Centre not on the list, for ${label}`}
          className={`w-40 ${selectCls}`}
        />
      ) : null}
    </div>
  );
}
