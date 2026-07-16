"use client";

import { useState } from "react";
import { RESOURCE_AUDIENCE_OPTIONS } from "@/lib/resources";

const cls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";
const labelCls = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

// Audience + Subject + Level for the admin resource form. Subject/Level are
// student-study attributes, so they only show when the resource is student-
// facing ('student' or 'both'); a coordinator-only resource (a coach handbook,
// the guidelines) has neither, and the hidden selects submit nothing → null.
export function ResourceAudienceFields({
  subjects,
  levels,
}: {
  subjects: string[];
  levels: string[];
}) {
  const [audience, setAudience] = useState("both");
  const studentFacing = audience === "student" || audience === "both";

  return (
    <>
      <label className="space-y-1">
        <span className={labelCls}>Shown to</span>
        <select
          name="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className={cls}
        >
          {RESOURCE_AUDIENCE_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
      </label>

      {studentFacing ? (
        <>
          <label className="space-y-1">
            <span className={labelCls}>Subject</span>
            <select name="subject" defaultValue="" className={cls}>
              <option value="">Any / n/a</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className={labelCls}>Level</span>
            <select name="level" defaultValue="" className={cls}>
              <option value="">Any / n/a</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </>
  );
}
