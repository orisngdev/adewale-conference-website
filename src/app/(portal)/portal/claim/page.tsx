import { redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import ClaimForm from "@/components/portal/claim-form";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata(
  "Claim your school",
  "Link your school to your account with the code from your confirmation email.",
);
export const dynamic = "force-dynamic";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { code } = await searchParams;

  return (
    <>
      <PortalHeader
        title="Claim your school"
        subtitle="Enter the code from your registration confirmation email"
      />
      <PortalBody>
        <Card className="p-5 md:p-6 max-w-md">
          <p className="serif-display italic text-[#4A4E5C] mb-4">
            Your claim code links this account to your school so you can track
            status, manage representatives, and download certificates.
          </p>
          <ClaimForm defaultCode={code} />
        </Card>
      </PortalBody>
    </>
  );
}
