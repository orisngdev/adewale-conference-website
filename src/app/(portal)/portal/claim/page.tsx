import { redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import ClaimForm from "@/components/portal/claim-form";
import RequestAccessForm from "@/components/portal/request-access-form";
import { pageMetadata } from "@/lib/seo";
import { getSessionUser } from "@/supabase/auth";
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

  const user = await getSessionUser();
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
          <p className="serif-display italic text-muted-foreground mb-4">
            Your claim code links this account to your school so you can track
            status, manage representatives, and download certificates.
          </p>
          <ClaimForm defaultCode={code} />
        </Card>

        <Card className="p-5 md:p-6 max-w-md">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground mb-2">
            No claim code?
          </p>
          <p className="serif-display italic text-muted-foreground mb-4">
            Find your school and request access — an admin reviews it and
            you&apos;ll be notified once approved.
          </p>
          <RequestAccessForm />
        </Card>
      </PortalBody>
    </>
  );
}
