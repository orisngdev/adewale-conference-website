import { notFound } from "next/navigation";
import { PaperResultView, type PaperResult } from "@/components/portal/paper-result-view";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("Paper result", "A rep's qualifying exam, item by item.");
export const dynamic = "force-dynamic";

export default async function SchoolPaperResult({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured) notFound();
  if (!(await getSessionUser())) notFound();

  const { id } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_paper_result", { p_paper_id: id });
  if (error) throw new Error(`Could not read this paper: ${error.message}`);
  if (!data) notFound();

  return (
    <PaperResultView result={data as unknown as PaperResult} backHref="/portal/school/results" />
  );
}
