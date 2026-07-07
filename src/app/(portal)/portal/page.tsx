import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const dynamic = "force-dynamic";

const AREAS = {
  student: {
    href: "/portal/student",
    label: "Student dashboard",
    desc: "Your status, schedule, resources, and certificate.",
  },
  coordinator: {
    href: "/portal/school",
    label: "School dashboard",
    desc: "Manage your reps, registration status, and materials.",
  },
  admin: {
    href: "/portal/admin",
    label: "Admin console",
    desc: "Verify registrations, issue certificates, manage content.",
  },
} as const;

type Role = keyof typeof AREAS;

const QUICK_LINKS = [
  { href: "/resources", label: "Resources", desc: "Past questions & study guides" },
  { href: "/editions", label: "Editions", desc: "Past & upcoming editions" },
  { href: "/results", label: "Hall of Fame", desc: "Champions & finalists" },
];

export default async function PortalHome() {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  let role: Role = "student";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role && profile.role in AREAS) role = profile.role as Role;

  const area = AREAS[role];

  return (
    <>
      <PortalHeader
        title={profile?.full_name ? `Welcome, ${profile.full_name}` : "Welcome"}
        subtitle={user.email ?? undefined}
      />
      <PortalBody>
        <Link href={area.href} className="block group">
          <Card interactive className="p-7 md:p-8">
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
              {role}
            </span>
            <h2 className="font-bebas text-4xl text-foreground mt-2">
              {area.label}
            </h2>
            <p className="serif-display italic text-muted-foreground mt-1">
              {area.desc}
            </p>
            <span className="inline-block mt-4 text-xs uppercase tracking-[0.2em] text-primary">
              Open →
            </span>
          </Card>
        </Link>

        <div className="grid gap-4 sm:grid-cols-3">
          {QUICK_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="block group">
              <Card interactive className="p-5 h-full">
                <h3 className="font-bebas text-xl text-foreground">{l.label}</h3>
                <p className="text-sm text-muted-foreground mt-1">{l.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </PortalBody>
    </>
  );
}
