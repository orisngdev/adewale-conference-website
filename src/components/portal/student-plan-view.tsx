"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";

interface Item {
  id: string;
  item_type: "assessment" | "material" | "link" | "note";
  title: string | null;
  required: boolean;
  assessment_id: string | null;
  assessment_mode: "practice" | "exam" | null;
  resource_id: string | null;
  external_url: string | null;
  note_md: string | null;
  status: "not_started" | "in_progress" | "completed";
  score: number | null;
}
interface Module {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  items: Item[];
}
export interface StudentPlan {
  id: string;
  title: string;
  description: string | null;
  modules: Module[];
}

export default function StudentPlanView({ plan }: { plan: StudentPlan }) {
  const supabase = useMemo(() => createClient(), []);
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    plan.modules.forEach((m) => m.items.forEach((i) => { if (i.status === "completed") init[i.id] = true; }));
    return init;
  });

  const allItems = plan.modules.flatMap((m) => m.items);
  const requiredItems = allItems.filter((i) => i.required);
  const completed = requiredItems.filter((i) => done[i.id]).length;
  const pct = requiredItems.length ? Math.round((completed / requiredItems.length) * 100) : 0;

  async function markDone(itemId: string) {
    setDone((d) => ({ ...d, [itemId]: true }));
    await supabase.rpc("complete_module_item", { p_item_id: itemId, p_status: "completed", p_score: null });
  }

  function itemHref(it: Item) {
    if (it.item_type === "assessment" && it.assessment_id) {
      return it.assessment_mode === "practice"
        ? `/portal/student/practice/${it.assessment_id}`
        : `/portal/cbt/${it.assessment_id}`;
    }
    if (it.item_type === "material") return `/portal/student/resources`;
    if (it.item_type === "link" && it.external_url) return it.external_url;
    return null;
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-medium text-foreground">Overall progress</p>
          <p className="text-sm text-muted-foreground">{completed}/{requiredItems.length} · {pct}%</p>
        </div>
        <div className="mt-2 h-2 rounded-full bg-foreground/10 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      {plan.modules.map((m, mi) => (
        <div key={m.id}>
          <h3 className="font-bebas text-xl text-foreground">
            {mi + 1}. {m.title}
            {m.due_date ? <span className="ml-2 text-xs text-muted-foreground">due {m.due_date}</span> : null}
          </h3>
          {m.description ? <p className="text-sm text-muted-foreground mb-2">{m.description}</p> : null}
          <div className="space-y-2 mt-2">
            {m.items.map((it) => {
              const href = itemHref(it);
              const isDone = done[it.id];
              const external = it.item_type === "link";
              return (
                <Card key={it.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground">
                      {isDone ? "✅ " : "○ "}
                      <span className="uppercase text-[10px] tracking-wide text-primary mr-2">{it.item_type}</span>
                      {it.title || it.note_md || it.external_url || "Item"}
                      {it.required ? "" : <span className="ml-1 text-xs text-muted-foreground">(optional)</span>}
                    </p>
                    {it.item_type === "note" && it.note_md ? (
                      <p className="text-sm text-muted-foreground mt-1">{it.note_md}</p>
                    ) : null}
                    {it.status === "completed" && it.score != null ? (
                      <p className="text-xs text-muted-foreground mt-1">Best score: {it.score}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {href ? (
                      external ? (
                        <a href={href} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="outline">Open ↗</Button>
                        </a>
                      ) : (
                        <Button asChild size="sm" variant="outline"><Link href={href}>Open</Link></Button>
                      )
                    ) : null}
                    {it.item_type !== "assessment" && !isDone ? (
                      <Button size="sm" onClick={() => markDone(it.id)}>Mark done</Button>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
