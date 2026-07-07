import { redirect } from "next/navigation";
import AdminNav from "@/components/portal/admin-nav";
import { getSessionUser, getUserRole } from "@/supabase/auth";
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

  return (
    <div className="md:flex max-w-[1400px] mx-auto">
      <aside className="md:w-56 shrink-0 md:px-4 md:py-8">
        <AdminNav />
      </aside>
      <div className="flex-1 min-w-0 pb-24 md:pb-0">{children}</div>
    </div>
  );
}
