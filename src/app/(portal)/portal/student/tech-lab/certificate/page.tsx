import { redirect } from "next/navigation";
import PrintButton from "@/components/portal/print-button";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { TECH_LAB_STEPS } from "@/lib/tech-lab";

export const dynamic = "force-dynamic";

export default async function TechLabCertificate() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data: prog } = await supabase
    .from("tech_lab_progress")
    .select("step_key")
    .eq("student_user_id", user.id);
  const done = new Set(((prog ?? []) as { step_key: string }[]).map((r) => r.step_key));
  if (!TECH_LAB_STEPS.every((s) => done.has(s.key))) redirect("/portal/student/tech-lab");

  const [{ data: profile }, { data: student }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("students").select("name").eq("auth_user_id", user.id).maybeSingle(),
  ]);
  const name = student?.name ?? profile?.full_name ?? "Student";

  return (
    <div className="space-y-4">
      <PrintButton />
      <div className="bg-card border-4 border-primary p-10 md:p-16 text-center max-w-3xl mx-auto">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary">
          Adewale Students Conference
        </p>
        <p className="font-bebas text-3xl md:text-5xl text-foreground mt-4">Certificate of Completion</p>
        <p className="serif-display italic text-muted-foreground mt-6">This certifies that</p>
        <p className="font-bebas text-2xl md:text-4xl text-foreground mt-2">{name}</p>
        <p className="serif-display italic text-muted-foreground mt-6 max-w-xl mx-auto">
          has completed the Future Tech Skills Lab learning path — Scratch, Python fundamentals,
          and data libraries.
        </p>
        <p className="text-sm text-muted-foreground mt-8">Building tomorrow&apos;s geniuses today.</p>
      </div>
    </div>
  );
}
