"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import ActionForm from "@/components/portal/action-form";
import { resolvePaperRow } from "@/app/(portal)/portal/admin/paper-exams/actions";
import { Select } from "@/components/ui/select";

// Attach one captured paper to a student, or discard it with a reason. No third
// option: commit is gated on nothing being left undecided.

interface RosterEntry {
  id: string;
  name: string;
  school: string | null;
}

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

export default function PaperRowResolver({
  paperId,
  roster,
}: {
  paperId: string;
  roster: RosterEntry[];
}) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"assign" | "discard">("assign");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster.slice(0, 20);
    const tokens = q.split(/\s+/);
    return roster
      .filter((s) => {
        const hay = `${s.name} ${s.school ?? ""}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .slice(0, 20);
  }, [query, roster]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMode("assign")}
          className={`cursor-pointer rounded-full px-2 py-0.5 ${
            mode === "assign" ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          Attach to a student
        </button>
        <button
          type="button"
          onClick={() => setMode("discard")}
          className={`cursor-pointer rounded-full px-2 py-0.5 ${
            mode === "discard" ? "bg-primary/10 text-primary" : "text-muted-foreground"
          }`}
        >
          Discard
        </button>
      </div>

      {mode === "assign" ? (
        <ActionForm action={resolvePaperRow.bind(null, paperId)} className="flex flex-wrap gap-2">
          <input type="hidden" name="op" value="assign" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the roster by name or school"
            className={`min-w-[16rem] flex-1 ${inputCls}`}
          />
          <Select name="student_id" required defaultValue="">
            <option value="" disabled>
              Choose a student…
            </option>
            {matches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.school ? ` — ${s.school}` : ""}
              </option>
            ))}
          </Select>
          <input name="note" placeholder="Note (optional)" className={inputCls} />
          <Button type="submit" variant="outline">
            Attach
          </Button>
        </ActionForm>
      ) : (
        <ActionForm action={resolvePaperRow.bind(null, paperId)} className="flex flex-wrap gap-2">
          <input type="hidden" name="op" value="discard" />
          <input
            name="note"
            required
            placeholder="Why is this paper being discarded? (required)"
            className={`min-w-[20rem] flex-1 ${inputCls}`}
          />
          <Button type="submit" variant="outline">
            Discard
          </Button>
        </ActionForm>
      )}
    </div>
  );
}
