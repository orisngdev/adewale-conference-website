"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import { TECH_LAB_STEPS } from "@/lib/tech-lab";

export default function TechLabProgress({ initialDone }: { initialDone: string[] }) {
  const [done, setDone] = useState<Set<string>>(() => new Set(initialDone));
  const [busy, setBusy] = useState<string | null>(null);

  async function mark(key: string) {
    setBusy(key);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("tech_lab_progress")
          .upsert(
            { student_user_id: user.id, step_key: key },
            { onConflict: "student_user_id,step_key" },
          );
      }
      setDone((d) => new Set(d).add(key));
    } finally {
      setBusy(null);
    }
  }

  const total = TECH_LAB_STEPS.length;
  const completed = TECH_LAB_STEPS.filter((s) => done.has(s.key)).length;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed === total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TECH_LAB_STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 rounded-full text-sm ${done.has(s.key) ? "bg-primary text-white" : "bg-foreground/5 text-muted-foreground"}`}
            >
              {i + 1}. {s.title.split(" — ")[0]}
            </span>
            <span className="text-muted-foreground">→</span>
          </div>
        ))}
        <span className={`px-3 py-1.5 rounded-full text-sm ${allDone ? "bg-green-600 text-white" : "bg-foreground/5 text-muted-foreground"}`}>
          🎓 Certificate
        </span>
      </div>

      <div>
        <div className="h-2 rounded-full bg-foreground/10 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-muted-foreground mt-1">{completed}/{total} steps · {pct}%</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TECH_LAB_STEPS.map((s) => (
          <Card key={s.key} className="p-4 flex flex-col">
            <p className="font-bebas text-lg text-foreground">{s.title}</p>
            <p className="text-sm text-muted-foreground mt-1 flex-1">{s.desc}</p>
            <div className="mt-3 flex items-center gap-3">
              <a
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs uppercase tracking-[0.15em] text-primary hover:underline"
              >
                Learn →
              </a>
              {done.has(s.key) ? (
                <span className="text-xs text-green-700">✓ Done</span>
              ) : (
                <Button size="sm" variant="outline" onClick={() => mark(s.key)} disabled={busy === s.key}>
                  {busy === s.key ? "…" : "Mark done"}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {allDone ? (
        <Card className="p-5 text-center border-l-4 border-l-green-600">
          <p className="font-bebas text-2xl text-foreground">Path complete! 🎓</p>
          <p className="text-sm text-muted-foreground">You&apos;ve finished the Tech Skills path.</p>
          <Button asChild className="mt-3">
            <Link href="/portal/student/tech-lab/certificate">Get your certificate</Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
