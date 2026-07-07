import { redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import ResetForm from "@/components/portal/reset-form";
import { pageMetadata } from "@/lib/seo";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("Set a new password", "Choose a new password for your account.");
export const dynamic = "force-dynamic";

export default async function ResetPage() {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  return (
    <>
      <PortalHeader title="New password" subtitle="Choose a password for your account" />
      <PortalBody>
        <Card className="p-5 md:p-6 max-w-md">
          <ResetForm />
        </Card>
      </PortalBody>
    </>
  );
}
