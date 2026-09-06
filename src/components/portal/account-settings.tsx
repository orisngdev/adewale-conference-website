import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card, SectionHeading } from "@/components/portal/ui";
import ResetForm from "@/components/portal/reset-form";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isCodeLoginEmail } from "@/lib/student-accounts";
import { updateName } from "@/app/(portal)/portal/settings/actions";

// Shared "Your account" section (name + password) rendered inside each role's
// settings page so the sidebar stays in place. showHeading=false when the
// enclosing page already labels the section (e.g. a tab).
export default async function AccountSettings({
  showHeading = true,
}: {
  showHeading?: boolean;
}) {
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  // A Rep's password IS their access code — a password form here locks them out.
  const codeLogin = isCodeLoginEmail(user?.email);

  return (
    <div>
      {showHeading ? <SectionHeading>Your account</SectionHeading> : null}
      <Card className="p-5 space-y-4">
        {user?.email && !codeLogin ? (
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="text-foreground font-medium">{user.email}</span>
          </p>
        ) : null}
        <form action={updateName} className="flex flex-col sm:flex-row gap-2">
          <input
            name="full_name"
            defaultValue={profile?.full_name ?? ""}
            placeholder="Full name"
            className="flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <ConfirmSubmitButton
            size="sm"
            variant="outline"
            title="Update your name?"
            description="This is the name shown across the portal."
            confirmLabel="Yes, save"
          >
            Save name
          </ConfirmSubmitButton>
        </form>
        {codeLogin ? (
          <p className="text-sm text-muted-foreground">
            You sign in with your access code — there is no password to change. If your
            code stops working, ask your school&apos;s coordinating teacher to check it
            for you.
          </p>
        ) : (
          <div className="max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Change password
            </p>
            <ResetForm />
          </div>
        )}
      </Card>
    </div>
  );
}
