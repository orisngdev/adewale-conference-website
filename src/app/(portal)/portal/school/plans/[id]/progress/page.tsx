import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, SectionHeading } from "@/components/portal/ui";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

interface Row {
  student_id: string;
  name: string;
  level: string | null;
  total: number;
  completed: number;
}

export default async function PlanProgress({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const [{ data: plan }, { data }] = await Promise.all([
    supabase.from("learning_plans").select("id, title").eq("id", id).maybeSingle(),
    supabase.rpc("get_class_plan_progress", { p_plan_id: id }),
  ]);
  if (!plan) notFound();
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-4">
      <Link href={`/portal/school/plans/${id}`} className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline">
        ← Back to plan
      </Link>
      <SectionHeading>Progress · {plan.title} — {rows.length} student{rows.length === 1 ? "" : "s"}</SectionHeading>
        {rows.length === 0 ? (
          <p className="serif-display italic text-muted-foreground">
            No students assigned yet — assign this plan from the build page.
          </p>
        ) : (
          <Card className="divide-y divide-foreground/5">
            {rows.map((r) => {
              const pct = r.total ? Math.round((r.completed / r.total) * 100) : 0;
              return (
                <div key={r.student_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">
                      {r.name} {r.level ? <span className="text-muted-foreground">· {r.level}</span> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{r.completed}/{r.total} · {pct}%</p>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-foreground/10 overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>
        )}
    </div>
  );
}
