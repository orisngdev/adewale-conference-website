import PortalNav, { type PortalTab } from "@/components/portal/portal-nav";
import { createClient } from "@/supabase/server";
import { isSupabaseConfigured } from "@/supabase/env";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  let role = "student";

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      email = user.email ?? null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role) role = profile.role;
    }
  }

  const tabs: PortalTab[] = [];
  if (email) {
    tabs.push({ href: "/portal", label: "Home" });
    if (role === "admin") tabs.push({ href: "/portal/admin", label: "Admin" });
    else if (role === "coordinator")
      tabs.push({ href: "/portal/school", label: "My school" });
    else tabs.push({ href: "/portal/student", label: "My dashboard" });
  }

  return (
    <div className="min-h-screen bg-[#FAF7F0] flex flex-col">
      <PortalNav email={email} tabs={tabs} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
