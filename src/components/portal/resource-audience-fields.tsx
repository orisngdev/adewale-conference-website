"use client";

import { useState } from "react";
import { RESOURCE_AUDIENCE_OPTIONS } from "@/lib/resources";
import { Select } from "@/components/ui/select";

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
        <Select
          name="audience"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        >
          {RESOURCE_AUDIENCE_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </label>

      {studentFacing ? (
        <>
          <label className="space-y-1">
            <span className={labelCls}>Subject</span>
            <Select name="subject" defaultValue="">
              <option value="">Any / n/a</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>

          <label className="space-y-1">
            <span className={labelCls}>Level</span>
            <Select name="level" defaultValue="">
              <option value="">Any / n/a</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </label>
        </>
      ) : null}
    </>
  );
}
