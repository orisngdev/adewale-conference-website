import { redirect } from "next/navigation";
import StudentSidebar from "@/components/portal/student-sidebar";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data: studentRecord } = await supabase
    .from("students")
    .select("name, schools(name)")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  const name = studentRecord?.name ?? "Your dashboard";
  const school = (
    studentRecord?.schools as unknown as { name: string | null } | null
  )?.name;

  return (
    <div className="px-4 md:px-6 py-6 md:py-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="font-bebas text-3xl md:text-4xl text-foreground leading-[0.95]">
          {name}
        </h1>
        <p className="serif-display italic text-muted-foreground mt-0.5 mb-6">
          {school ?? "Track your conference journey"}
        </p>
        <div className="flex flex-col md:flex-row md:gap-6">
          <aside className="md:w-56 shrink-0">
            <StudentSidebar />
          </aside>
          <div className="flex-1 min-w-0 space-y-6 pb-24 md:pb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
