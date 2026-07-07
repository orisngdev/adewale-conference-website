"use client";

import { useRef, useState } from "react";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { BMC_BLOCKS } from "@/lib/pitch-studio";

interface Note {
  id: string;
  text: string;
}
type Data = Record<string, Note[]>;

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

// Nine-block Business Model Canvas with sticky notes. Add / edit / delete, and
// drag notes between blocks (native HTML5 DnD — no dependency). Persists per
// student to pitch_canvas.
export default function BmcBoard({ initial }: { initial: Data }) {
  const [data, setData] = useState<Data>(() => {
    const d: Data = {};
    BMC_BLOCKS.forEach((b) => {
      d[b.key] = Array.isArray(initial?.[b.key]) ? initial[b.key] : [];
    });
    return d;
  });
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const dragging = useRef<{ from: string; id: string } | null>(null);

  function update(next: Data) {
    setData(next);
    setSaved(false);
  }
  const addNote = (block: string) => update({ ...data, [block]: [...data[block], { id: uid(), text: "" }] });
  const editNote = (block: string, id: string, text: string) =>
    update({ ...data, [block]: data[block].map((n) => (n.id === id ? { ...n, text } : n)) });
  const delNote = (block: string, id: string) =>
    update({ ...data, [block]: data[block].filter((n) => n.id !== id) });

  function onDrop(toBlock: string) {
    const d = dragging.current;
    dragging.current = null;
    if (!d || d.from === toBlock) return;
    const note = data[d.from].find((n) => n.id === d.id);
    if (!note) return;
    update({
      ...data,
      [d.from]: data[d.from].filter((n) => n.id !== d.id),
      [toBlock]: [...data[toBlock], note],
    });
  }

  async function save() {
    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("pitch_canvas").upsert(
          { owner_user_id: user.id, data, updated_at: new Date().toISOString() },
          { onConflict: "owner_user_id" },
        );
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} disabled={saving || saved}>
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save canvas"}
        </Button>
        <span className="text-xs text-muted-foreground">Add notes with +, drag them between blocks.</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {BMC_BLOCKS.map((b) => (
          <div
            key={b.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(b.key)}
            className="rounded-md border border-foreground/15 bg-card p-3 min-h-36"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">{b.title}</p>
              <button
                type="button"
                onClick={() => addNote(b.key)}
                className="text-primary text-xl leading-none hover:text-foreground"
                aria-label={`Add note to ${b.title}`}
              >
                +
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {data[b.key].map((n) => (
                <div
                  key={n.id}
                  draggable
                  onDragStart={() => {
                    dragging.current = { from: b.key, id: n.id };
                  }}
                  className="group rounded bg-[#FEF3D7] border border-primary/40 p-2 cursor-move"
                >
                  <textarea
                    value={n.text}
                    onChange={(e) => editNote(b.key, n.id, e.target.value)}
                    rows={2}
                    placeholder="Idea…"
                    className="w-full bg-transparent text-sm text-foreground outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={() => delNote(b.key, n.id)}
                    className="text-[10px] text-red-600 opacity-60 hover:opacity-100"
                  >
                    remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
