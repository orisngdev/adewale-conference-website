import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StudentPlanView, { type StudentPlan } from "@/components/portal/student-plan-view";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

export default async function StudentPlanPage({ params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data } = await supabase.rpc("get_student_plan", { p_plan_id: id });
  const plan = data as StudentPlan | null;
  if (!plan) notFound();

  return (
    <div className="space-y-4">
      <Link href="/portal/student/plans" className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline">
        ← All plans
      </Link>
      <div>
        <h2 className="font-bebas text-2xl md:text-3xl text-foreground">{plan.title}</h2>
        {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
      </div>
      <StudentPlanView plan={plan} />
    </div>
  );
}
