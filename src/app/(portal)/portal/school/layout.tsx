import { redirect } from "next/navigation";
import SchoolSidebar from "@/components/portal/school-sidebar";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export default async function SchoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  // Prefer a registration's school; otherwise fall back to an approved
  // membership — both fetched concurrently since either may win.
  const [{ data: reg }, { data: mem }] = await Promise.all([
    supabase
      .from("registrations")
      .select("schools(name)")
      .order("edition_year", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("school_members")
      .select("schools(name)")
      .eq("status", "approved")
      .limit(1)
      .maybeSingle(),
  ]);
  const schoolName =
    (reg?.schools as unknown as { name: string | null } | null)?.name ??
    (mem?.schools as unknown as { name: string | null } | null)?.name ??
    null;

  return (
    <div className="px-4 md:px-6 py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-bebas text-3xl md:text-4xl text-foreground leading-[0.95]">
          {schoolName ?? "Your school"}
        </h1>
        <p className="serif-display italic text-muted-foreground mt-0.5 mb-6">
          Manage your representatives and track results
        </p>
        <div className="flex flex-col md:flex-row md:gap-6">
          <aside className="md:w-56 shrink-0">
            <SchoolSidebar />
          </aside>
          <div className="flex-1 min-w-0 space-y-6 pb-24 md:pb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
