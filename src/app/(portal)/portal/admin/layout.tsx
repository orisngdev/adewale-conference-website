import { redirect } from "next/navigation";
import AdminNav from "@/components/portal/admin-nav";
import { getAdminPermissions, getSessionUser, getUserRole } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

// Single role gate for the whole admin area — sub-pages can assume admin.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  if ((await getUserRole()) !== "admin") redirect("/portal");

  // The nav only shows sections this admin can at least view (per-module gates
  // and server-action checks enforce the same rules on the pages themselves).
  const perms = await getAdminPermissions();

  return (
    <div className="md:flex max-w-[1400px] mx-auto">
      <aside className="md:w-56 shrink-0 md:px-4 md:py-8">
        <AdminNav perms={perms} />
      </aside>
      <div className="flex-1 min-w-0 pb-24 md:pb-0">{children}</div>
    </div>
  );
}
