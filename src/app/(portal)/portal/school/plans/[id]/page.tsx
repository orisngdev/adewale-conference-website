import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, SectionHeading } from "@/components/portal/ui";
import { SubmitButton } from "@/components/portal/submit-button";
import PlanItemForm from "@/components/portal/plan-item-form";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { sanityFetch } from "@/sanity/lib/live";
import { resourcesQuery } from "@/sanity/lib/queries";
import type { ResourceListItem } from "@/sanity/types";
import { LEVELS } from "@/lib/assessments";
import {
  addItem,
  addModule,
  assignByLevel,
  assignStudent,
  deleteItem,
  deleteModule,
  deletePlan,
  removeAssignment,
  togglePlanPublished,
} from "../actions";

export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

interface Item {
  id: string;
  position: number;
  item_type: string;
  title: string | null;
  assessment_id: string | null;
  resource_id: string | null;
  external_url: string | null;
  note_md: string | null;
  required: boolean;
}
interface Module {
  id: string;
  title: string;
  due_date: string | null;
  position: number;
  plan_module_items: Item[];
}

export default async function PlanBuilder({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data: plan } = await supabase
    .from("learning_plans")
    .select("id, title, subject, level, published, school_id, edition_year")
    .eq("id", id)
    .maybeSingle();
  if (!plan) notFound();

  const [{ data: modData }, { data: aData }, { data: stData }, { data: asgData }, { data: matData }] =
    await Promise.all([
      supabase
        .from("plan_modules")
        .select("id, title, due_date, position, plan_module_items(id, position, item_type, title, assessment_id, resource_id, external_url, note_md, required)")
        .eq("plan_id", id)
        .order("position", { ascending: true }),
      supabase.from("assessments").select("id, title, mode").eq("published", true).order("title"),
      supabase.from("students").select("id, name, level").eq("school_id", plan.school_id).eq("edition_year", plan.edition_year).order("name"),
      supabase.from("plan_assignments").select("id, assignee_type, level, student_id").eq("plan_id", id),
      sanityFetch({ query: resourcesQuery, params: { type: "", subject: "", level: "" } }),
    ]);

  const modules = ((modData ?? []) as Module[]).map((m) => ({
    ...m,
    plan_module_items: [...(m.plan_module_items ?? [])].sort((x, y) => x.position - y.position),
  }));
  const assessments = (aData ?? []) as { id: string; title: string; mode: string }[];
  const students = (stData ?? []) as { id: string; name: string; level: string | null }[];
  const assignments = (asgData ?? []) as { id: string; assignee_type: string; level: string | null; student_id: string | null }[];
  const materials = ((matData ?? []) as ResourceListItem[])
    .filter((r) => r.hasFile)
    .map((r) => ({ _id: r._id, title: r.title }));
  const studentName = (sid: string | null) => students.find((s) => s.id === sid)?.name ?? "student";

  return (
    <div className="space-y-6">
      <Link href="/portal/school/plans" className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline">
        ← All plans
      </Link>
      <div>
        <h2 className="font-bebas text-2xl md:text-3xl text-foreground">{plan.title}</h2>
        <p className="text-sm text-muted-foreground">
          {[plan.subject, plan.level].filter(Boolean).join(" · ") || "All subjects"} · {plan.published ? "Published" : "Draft"}
        </p>
      </div>

      {/* Visibility status — a plan reaches students only when published AND assigned. */}
      {(() => {
        const who = assignments
          .map((a) => (a.assignee_type === "level" ? `all ${a.level ?? "levels"}` : studentName(a.student_id)))
          .join(", ");
        const live = plan.published && assignments.length > 0;
        return (
          <Card className={`p-4 border-l-4 ${live ? "border-l-green-600" : "border-l-primary"}`}>
            {live ? (
              <p className="text-sm text-foreground">
                <span className="font-bold text-green-700">Live.</span> Students matching{" "}
                <span className="font-medium">{who}</span> (edition {plan.edition_year}) can see this plan.
              </p>
            ) : !plan.published ? (
              <p className="text-sm text-foreground">
                <span className="font-bold text-primary">Draft — students can’t see this yet.</span> Click{" "}
                <span className="font-medium">“Publish to students”</span> below, then assign it under{" "}
                <span className="font-medium">“Who gets this plan”</span>.
              </p>
            ) : (
              <p className="text-sm text-foreground">
                <span className="font-bold text-primary">Published, but assigned to no one — still hidden.</span>{" "}
                Assign a level or specific students under <span className="font-medium">“Who gets this plan”</span> below.
              </p>
            )}
          </Card>
        );
      })()}
      <div className="flex flex-wrap gap-2">
          <form action={togglePlanPublished.bind(null, plan.id, !plan.published)}>
            <SubmitButton size="sm" variant={plan.published ? "outline" : "default"}>
              {plan.published ? "Published — unpublish" : "Publish to students"}
            </SubmitButton>
          </form>
          <Button asChild size="sm" variant="outline"><Link href={`/portal/school/plans/${plan.id}/progress`}>View progress</Link></Button>
          <form action={deletePlan.bind(null, plan.id)}>
            <Button type="submit" size="sm" variant="outline">Delete</Button>
          </form>
        </div>

        {/* Assignments */}
        <div>
          <SectionHeading>Who gets this plan (edition {plan.edition_year})</SectionHeading>
          <Card className="p-4 space-y-3">
            <form action={assignByLevel.bind(null, plan.id)} className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Assign to level:</span>
              <select name="level" defaultValue="" className={inputCls}>
                <option value="">All levels</option>
                {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <SubmitButton size="sm" variant="outline" pendingText="Assigning…">Assign level</SubmitButton>
            </form>

            {students.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {students.map((s) => (
                  <form key={s.id} action={assignStudent.bind(null, plan.id, s.id)}>
                    <button type="submit" className="text-xs px-2 py-1 rounded border border-foreground/15 hover:border-primary text-muted-foreground">
                      + {s.name} {s.level ? `(${s.level})` : ""}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No students provisioned for this edition yet.</p>
            )}

            {assignments.length > 0 ? (
              <ul className="text-sm space-y-1">
                {assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className="text-foreground">
                      {a.assignee_type === "level" ? `All ${a.level ?? "levels"}` : studentName(a.student_id)}
                    </span>
                    <form action={removeAssignment.bind(null, a.id, plan.id)}>
                      <button type="submit" className="text-xs text-red-600 hover:underline">remove</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>
        </div>

        {/* Modules */}
        <div>
          <SectionHeading>Modules (ordered — a recommended path, not locked)</SectionHeading>
          <div className="space-y-4">
            {modules.map((m, mi) => (
              <Card key={m.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bebas text-lg text-foreground">
                    {mi + 1}. {m.title}
                    {m.due_date ? <span className="ml-2 text-xs text-muted-foreground">due {m.due_date}</span> : null}
                  </p>
                  <form action={deleteModule.bind(null, m.id, plan.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">delete module</button>
                  </form>
                </div>

                {m.plan_module_items.length > 0 ? (
                  <ul className="text-sm space-y-1">
                    {m.plan_module_items.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-2">
                        <span className="text-foreground">
                          <span className="uppercase text-[10px] tracking-wide text-primary mr-2">{it.item_type}</span>
                          {it.title || it.external_url || it.note_md || "item"}
                          {it.required ? "" : <span className="ml-1 text-muted-foreground">(optional)</span>}
                        </span>
                        <form action={deleteItem.bind(null, it.id, plan.id)}>
                          <button type="submit" className="text-xs text-red-600 hover:underline">×</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No items yet.</p>
                )}

                <PlanItemForm
                  action={addItem.bind(null, m.id, plan.id)}
                  assessments={assessments}
                  materials={materials}
                />
              </Card>
            ))}
          </div>

          <Card className="p-4 mt-4">
            <form action={addModule.bind(null, plan.id)} className="flex flex-wrap items-end gap-2">
              <input name="title" required placeholder="New module title" className={`flex-1 ${inputCls}`} />
              <label className="text-xs text-muted-foreground">Due date
                <input name="due_date" type="date" className={`ml-1 ${inputCls}`} />
              </label>
              <SubmitButton size="sm" pendingText="Adding…">Add module</SubmitButton>
            </form>
          </Card>
        </div>
    </div>
  );
}
