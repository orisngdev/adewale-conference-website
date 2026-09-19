import { notFound } from "next/navigation";
import { PortalBody, PortalHeader } from "@/components/portal/ui";
import { PaperResultView, type PaperResult } from "@/components/portal/paper-result-view";
import { formatCandidateNumber } from "@/lib/paper-exam";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { requireModuleView } from "@/supabase/auth";

export const metadata = pageMetadata("Paper result", "A captured paper, item by item.");
export const dynamic = "force-dynamic";

export default async function AdminPaperResult({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireModuleView("participants");

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_paper_result", { p_paper_id: id });
  if (error) throw new Error(`Could not read this paper: ${error.message}`);
  if (!data) notFound();
  const result = data as unknown as PaperResult;

  return (
    <>
      <PortalHeader
        title={result.student_name ?? "Paper"}
        subtitle={[
          result.school_name,
          result.exam_no ? `candidate ${formatCandidateNumber(result.exam_no)}` : null,
          result.title,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <PortalBody>
        <PaperResultView result={result} backHref="/portal/admin/participants?view=qualifications" />
      </PortalBody>
    </>
  );
}
