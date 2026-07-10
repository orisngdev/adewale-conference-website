import PortalNav, { type PortalTab } from "@/components/portal/portal-nav";
import RegisterSW from "@/components/pwa/register-sw";
import { createClient } from "@/supabase/server";
import { getSessionUser, getUserRole } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  let role = "student";
  let unread = 0;

  if (isSupabaseConfigured) {
    const user = await getSessionUser();
    if (user) {
      email = user.email ?? null;
      const supabase = await createClient();
      // Role lookup and the unread count don't depend on each other — run together.
      const [roleValue, notif] = await Promise.all([
        getUserRole(),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("read", false),
      ]);
      role = roleValue ?? "student";
      unread = notif.count ?? 0;
    }
  }

  const tabs: PortalTab[] = [];
  if (email) {
    tabs.push({ href: "/portal", label: "Home" });
    if (role === "admin") tabs.push({ href: "/portal/admin", label: "Admin" });
    else if (role === "coordinator")
      tabs.push({ href: "/portal/school", label: "My school" });
    else tabs.push({ href: "/portal/student", label: "My dashboard" });
    // Settings lives in each role's sidebar, not up here.
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RegisterSW />
      <PortalNav email={email} tabs={tabs} unread={unread} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
