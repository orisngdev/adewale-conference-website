"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";

type Result = { public_score: number; matched: number; submitted: number; metric: string; lower_is_better: boolean };

function parseCsv(text: string, idCol: string, targetCol: string) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  let idIdx = header.indexOf(idCol.toLowerCase());
  let predIdx = header.indexOf(targetCol.toLowerCase());
  if (idIdx === -1) idIdx = 0;
  if (predIdx === -1) predIdx = header.length > 1 ? 1 : 0;
  const out: { id: string; prediction: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const id = (cells[idIdx] ?? "").trim();
    const prediction = Number((cells[predIdx] ?? "").trim());
    if (id && Number.isFinite(prediction)) out.push({ id, prediction });
  }
  return out;
}

export default function ChallengeSubmit({
  challengeId,
  idColumn,
  targetColumn,
}: {
  challengeId: string;
  idColumn: string;
  targetColumn: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const preds = parseCsv(await file.text(), idColumn, targetColumn);
      if (preds.length === 0) {
        throw new Error(`No rows found — your file needs columns "${idColumn}" and "${targetColumn}".`);
      }
      const supabase = createClient();
      const { data, error } = await supabase.rpc("score_submission", {
        p_challenge_id: challengeId,
        p_predictions: preds,
      });
      if (error) throw new Error(error.message);
      const d = data as Result;
      setMsg({
        ok: true,
        text: `Scored! ${d.metric.toUpperCase()} = ${d.public_score} on ${d.matched} rows${
          d.lower_is_better ? " (lower is better)" : ""
        }.`,
      });
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong — try again." });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={onFile}
        disabled={busy}
        className="hidden"
        aria-label="Upload predictions CSV"
      />
      <Button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? "Scoring…" : "Upload predictions (.csv)"}
      </Button>
      <p className="text-xs text-muted-foreground">
        A CSV with columns <span className="font-mono text-foreground">{idColumn},{targetColumn}</span> — one row per test id.
      </p>
      {msg ? (
        <p className={`text-sm ${msg.ok ? "text-green-700" : "text-destructive"}`}>{msg.text}</p>
      ) : null}
    </div>
  );
}
