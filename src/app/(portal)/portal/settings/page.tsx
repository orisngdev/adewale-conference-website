import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import ResetForm from "@/components/portal/reset-form";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { updateName } from "./actions";

export const metadata = pageMetadata("Settings", "Manage your account.");
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <>
      <PortalHeader title="Settings" subtitle={user.email ?? undefined} />
      <PortalBody>
        <div>
          <SectionHeading>Your details</SectionHeading>
          <Card className="p-5 md:p-6 space-y-3">
            <form action={updateName} className="flex flex-col sm:flex-row gap-2">
              <input
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                placeholder="Full name"
                className="flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <Button type="submit" size="sm">
                Save name
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              Role:{" "}
              <span className="capitalize text-foreground font-medium">
                {profile?.role ?? "student"}
              </span>
            </p>
          </Card>
        </div>

        <div>
          <SectionHeading>Change password</SectionHeading>
          <Card className="p-5 md:p-6 max-w-md">
            <ResetForm />
          </Card>
        </div>
      </PortalBody>
    </>
  );
}
