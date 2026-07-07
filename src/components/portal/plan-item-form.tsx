"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/portal/submit-button";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export default function PlanItemForm({
  action,
  assessments,
  materials,
}: {
  action: (formData: FormData) => void;
  assessments: { id: string; title: string; mode: string }[];
  materials: { _id: string; title: string }[];
}) {
  const [type, setType] = useState("assessment");
  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select
          name="item_type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={inputCls}
        >
          <option value="assessment">Practice / exam</option>
          <option value="material">Study pack</option>
          <option value="link">External link</option>
          <option value="note">Note</option>
        </select>
        <input name="title" placeholder="Label (optional)" className={inputCls} />
      </div>

      {type === "assessment" ? (
        <select name="assessment_id" className={inputCls}>
          <option value="">Select an assessment…</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>{a.title} ({a.mode})</option>
          ))}
        </select>
      ) : null}
      {type === "material" ? (
        <select name="resource_id" className={inputCls}>
          <option value="">Select a study pack…</option>
          {materials.map((m) => (
            <option key={m._id} value={m._id}>{m.title}</option>
          ))}
        </select>
      ) : null}
      {type === "link" ? (
        <input name="external_url" placeholder="https://…" className={inputCls} />
      ) : null}
      {type === "note" ? (
        <textarea name="note_md" rows={2} placeholder="Note for students…" className={inputCls} />
      ) : null}

      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground">
          <input type="checkbox" name="required" defaultChecked value="on" className="mr-1 accent-primary" />
          Required (counts toward progress)
        </label>
        <SubmitButton size="sm" pendingText="Adding…">Add item</SubmitButton>
      </div>
    </form>
  );
}
