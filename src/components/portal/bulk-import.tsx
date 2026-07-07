"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import {
  importQuestions,
  type ImportState,
} from "@/app/(portal)/portal/admin/question-bank/actions";

const initial: ImportState = { stage: "idle" };

const CSV_HINT =
  "mode,subject,level,topic,difficulty,prompt,option_1,option_2,option_3,option_4,correct,explanation,tags,edition_year";

export default function BulkImport({ assessmentId }: { assessmentId?: string }) {
  const [state, action, pending] = useActionState(importQuestions, initial);
  const [payload, setPayload] = useState("");

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setPayload(await f.text());
  }

  const inputCls =
    "rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

  return (
    <Card className="p-5 md:p-6 space-y-3">
      <form action={action} className="space-y-3">
        {assessmentId ? <input type="hidden" name="assessment_id" value={assessmentId} /> : null}
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">
            Default pool
            <select name="mode" defaultValue="practice" className={`ml-2 ${inputCls}`}>
              <option value="practice">Practice</option>
              <option value="exam">Exam</option>
            </select>
          </label>
          <input
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={onFile}
            className="text-sm"
          />
        </div>
        <textarea
          name="payload"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          rows={8}
          placeholder={`Paste CSV or JSON. CSV header:\n${CSV_HINT}`}
          className="w-full rounded-md border border-foreground/15 bg-card px-3 py-2 font-mono text-xs outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <Button type="submit" name="confirm" value="0" variant="outline" disabled={pending || !payload.trim()}>
            {pending ? "Working…" : "Preview"}
          </Button>
          <Button type="submit" name="confirm" value="1" disabled={pending || !payload.trim()}>
            Import valid rows
          </Button>
        </div>
      </form>

      {state.stage === "error" ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}
      {state.stage === "preview" ? (
        <p className="text-sm text-foreground">
          Parsed {state.parsed} row{state.parsed === 1 ? "" : "s"} — <strong>{state.valid} valid</strong>,{" "}
          {state.errors?.length ?? 0} with errors. Click <em>Import valid rows</em> to save the valid ones.
        </p>
      ) : null}
      {state.stage === "done" ? (
        <p className="text-sm text-green-700">
          Imported {state.inserted}. Skipped {state.skipped}.
        </p>
      ) : null}

      {state.errors && state.errors.length > 0 ? (
        <div className="max-h-48 overflow-auto rounded border border-red-200">
          <table className="w-full text-xs">
            <thead className="bg-red-50 text-red-700">
              <tr><th className="p-1 text-left">Row</th><th className="p-1 text-left">Field</th><th className="p-1 text-left">Problem</th></tr>
            </thead>
            <tbody>
              {state.errors.map((e, i) => (
                <tr key={i} className="border-t border-red-100">
                  <td className="p-1">{e.row}</td>
                  <td className="p-1">{e.field}</td>
                  <td className="p-1">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
