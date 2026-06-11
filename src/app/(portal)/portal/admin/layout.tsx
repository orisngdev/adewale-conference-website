import { redirect } from "next/navigation";
import AdminNav from "@/components/portal/admin-nav";
import { createClient } from "@/supabase/server";
import { isSupabaseConfigured } from "@/supabase/env";

// Single role gate for the whole admin area — sub-pages can assume admin.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/portal");

  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
