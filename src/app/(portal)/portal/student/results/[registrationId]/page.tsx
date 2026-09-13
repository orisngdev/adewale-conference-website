import { notFound } from "next/navigation";
import {
  SchoolStageBreakdown,
  type StageBreakdown,
} from "@/components/portal/school-stage-breakdown";
import { PAPER_BASE } from "@/lib/paper-results";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("School result", "What your school's score is made of.");
export const dynamic = "force-dynamic";

export default async function StudentSchoolStageResult({
  params,
  searchParams,
}: {
  params: Promise<{ registrationId: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  if (!isSupabaseConfigured) notFound();
  if (!(await getSessionUser())) notFound();

  const { registrationId } = await params;
  const { stage } = await searchParams;
  if (!stage) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_school_stage_breakdown", {
    p_registration_id: registrationId,
    p_stage: stage,
  });
  // A missing function is a deployment problem, not a missing page — saying so
  // beats a 404 that looks like the result does not exist.
  if (error) throw new Error(`Could not read this result: ${error.message}`);
  if (!data) notFound();

  return (
    <SchoolStageBreakdown
      detail={data as unknown as StageBreakdown}
      backHref="/portal/student/results"
      paperBase={PAPER_BASE.student}
    />
  );
}
