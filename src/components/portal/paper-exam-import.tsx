"use client";

import Link from "next/link";
import { useActionState, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import {
  importPaperResults,
  type PaperImportState,
} from "@/app/(portal)/portal/admin/paper-exams/actions";

const initial: PaperImportState = { stage: "idle" };

// The file is read in the browser and posted as a string, so no File crosses the
// server-action boundary — the same shape as bulk-import.tsx. The preview is
// deliberately thin: ~500 rows x 100 responses is too much to round-trip through
// action state, and resolution must survive a reload, so the staged rows on the
// review page are the real preview.
const SOFT_LIMIT_BYTES = 3 * 1024 * 1024;

export default function PaperExamImport({ examId }: { examId: string }) {
  const [state, action, pending] = useActionState(importPaperResults, initial);
  const [payload, setPayload] = useState("");
  const [filename, setFilename] = useState("");
  const [tooBig, setTooBig] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilename(f.name);
    setTooBig(f.size > SOFT_LIMIT_BYTES);
    setPayload(await f.text());
  }

  const rows = payload ? payload.trimEnd().split("\n").length - 1 : 0;

  return (
    <Card className="p-5 md:p-6 space-y-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="exam_id" value={examId} />
        <input type="hidden" name="filename" value={filename} />

        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
          {rows > 0 ? (
            <span className="text-xs text-muted-foreground">
              {rows} data row{rows === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <textarea
          name="payload"
          value={payload}
          onChange={(e) => {
            setPayload(e.target.value);
            setTooBig(false);
          }}
          rows={6}
          placeholder="Choose the capture tool's full export (with per-question student responses), or paste it here."
          className="w-full rounded-md border border-foreground/15 bg-card px-3 py-2 font-mono text-xs outline-none focus:border-primary"
        />

        {tooBig ? (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            That file is large enough to be refused in transit. Split the export by class or
            centre and import each part.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            name="confirm"
            value="0"
            variant="outline"
            disabled={pending || !payload.trim()}
          >
            {pending ? "Reading…" : "Check the file"}
          </Button>
          <Button
            type="submit"
            name="confirm"
            value="1"
            disabled={pending || !payload.trim() || state.stage !== "preview"}
          >
            Stage {state.parsed ?? ""} paper{state.parsed === 1 ? "" : "s"} for review
          </Button>
        </div>
        {state.stage !== "preview" && payload.trim() ? (
          <p className="text-xs text-muted-foreground">
            Check the file first — staging is enabled once the columns have been read.
          </p>
        ) : null}
      </form>

      {state.stage === "error" ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-sm text-foreground">{state.message}</p>
          {/* A partial stage still produced a batch worth looking at, so do not
              leave the only route to it as a guess. */}
          {state.importId ? (
            <p className="mt-2 text-sm">
              <Link
                href={`/portal/admin/paper-exams/${examId}/imports/${state.importId}`}
                className="text-primary hover:underline"
              >
                Open what was staged →
              </Link>
            </p>
          ) : null}
          {state.keyFromFile ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                The {state.keyFromFile.length} answers this file was marked against:
              </p>
              <textarea
                readOnly
                rows={3}
                value={state.keyFromFile}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-md border border-foreground/15 bg-card px-3 py-2 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Copy it into <span className="text-foreground">Answer key</span>, check it against
                the printed key, and save — then import this file again.
              </p>
            </div>
          ) : null}
          {state.unmapped?.length ? (
            <>
              <p className="mt-2 text-xs text-muted-foreground">Columns found in that file:</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {state.unmapped.join(" · ")}
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      {state.stage === "preview" ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat
              label="Sheets in the file"
              value={state.parsed ?? 0}
              hint="Every row we could read, matched or not. None are ever dropped."
            />
            <Stat
              label="Attached to a student"
              value={state.matched ?? 0}
              hint="We know whose paper this is, from the candidate number or the name."
            />
            <Stat
              label="Need you to decide"
              value={state.undecided ?? 0}
              emphasis={!!state.undecided}
              hint="We could not tell whose paper it is, or two sheets claim one student. Nothing publishes until these are settled."
            />
            <Stat
              label="Sheets with an unreadable mark"
              value={state.invalidMarkRows ?? 0}
              hint="At least one question was double-shaded or unclear. Those questions score nothing, as the paper's rules say — the rest of the sheet still counts."
            />
          </div>

          {state.warnings?.length ? (
            <ul className="space-y-1">
              {state.warnings.map((w) => (
                <li key={w} className="text-sm text-amber-600 dark:text-amber-500">
                  {w}
                </li>
              ))}
            </ul>
          ) : null}

          {/* The column mapping is shown BEFORE anything is written: the capture
              tool's export headers are undocumented and sniffed, so "it read the
              wrong column" has to be a five-second diagnosis. */}
          {state.mapping?.length ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Columns we read
              </p>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-4 font-normal">We need</th>
                      <th className="py-1 font-normal">We used</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {state.mapping.map((m) => (
                      <tr key={m.field} className="border-t border-foreground/5">
                        <td className="py-1 pr-4">{m.field}</td>
                        <td className="py-1">{m.column}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {state.unmapped?.length ? (
            <p className="text-xs text-muted-foreground">
              Ignored columns: <span className="font-mono">{state.unmapped.join(" · ")}</span>
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

// The hint is shown, not hidden behind a hover: these numbers are read once, by
// someone deciding whether to commit 491 results, and a tooltip is invisible on
// touch and to anyone who does not know to look for it.
function Stat({
  label,
  value,
  emphasis,
  hint,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-foreground/10 p-3" title={hint}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`text-xl tabular-nums ${
          emphasis ? "text-amber-600 dark:text-amber-500" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs leading-snug text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
