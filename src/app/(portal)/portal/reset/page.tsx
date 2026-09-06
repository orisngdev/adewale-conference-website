import { redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import ResetForm from "@/components/portal/reset-form";
import { pageMetadata } from "@/lib/seo";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { isCodeLoginEmail } from "@/lib/student-accounts";

export const metadata = pageMetadata("Set a new password", "Choose a new password for your account.");
export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  // A Rep signs in with their access code and has no password to reset.
  if (isCodeLoginEmail(user.email)) redirect("/portal/student");

  // `welcome=1` = arriving from a first-time email sign-in link — frame it as
  // finishing setup rather than a password reset.
  const { welcome } = await searchParams;
  const isWelcome = welcome === "1";

  return (
    <>
      <PortalHeader
        title={isWelcome ? "Set your password" : "New password"}
        subtitle={
          isWelcome
            ? "You're signed in — set a password to finish setting up your account"
            : "Choose a password for your account"
        }
      />
      <PortalBody>
        <Card className="p-5 md:p-6 max-w-md">
          <ResetForm />
        </Card>
      </PortalBody>
    </>
  );
}
