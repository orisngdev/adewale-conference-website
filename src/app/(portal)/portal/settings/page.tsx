import { redirect } from "next/navigation";
import { getSessionUser, getUserRole } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

// Settings moved into each role's sidebar — send old links to the right place.
export default async function SettingsRedirect() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const role = await getUserRole();
  if (role === "admin") redirect("/portal/admin/settings");
  if (role === "coordinator") redirect("/portal/school/settings");
  redirect("/portal/student/settings");
}
