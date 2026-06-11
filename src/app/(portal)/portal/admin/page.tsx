import Link from "next/link";
import { Card, PortalBody, PortalHeader, StatTile } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";

export const metadata = pageMetadata("Admin overview", "Conference platform overview.");
export const dynamic = "force-dynamic";

const SECTIONS = [
  { href: "/portal/admin/registrations", label: "Registrations", desc: "Verify status & issue certificates" },
  { href: "/portal/admin/users", label: "Users & roles", desc: "Manage admins, coordinators, students" },
  { href: "/portal/admin/sponsors", label: "Sponsors", desc: "From Sanity — edit in the Studio" },
  { href: "/portal/admin/schools", label: "Schools", desc: "Schools registered in the portal" },
  { href: "/portal/admin/participants", label: "Participants", desc: "Registrations from Airtable" },
];

type RegRow = { id: string; status: string; certificates: { id: string }[] };

export default async function AdminOverview() {
  const supabase = await createClient();
  const [{ data: regs }, { count: userCount }, { count: schoolCount }] =
    await Promise.all([
      supabase.from("registrations").select("id, status, certificates(id)"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("schools").select("id", { count: "exact", head: true }),
    ]);

  const registrations = (regs ?? []) as unknown as RegRow[];
  const pending = registrations.filter((r) => r.status === "submitted").length;
  const certs = registrations.reduce(
    (n, r) => n + (r.certificates?.length ?? 0),
    0,
  );

  return (
    <>
      <PortalHeader
        title="Staff console"
        subtitle="Overview of the conference platform"
      />
      <PortalBody>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Registrations" value={registrations.length} />
          <StatTile label="Pending review" value={pending} />
          <StatTile label="Users" value={userCount ?? 0} />
          <StatTile label="Certificates" value={certs} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="block group">
              <Card className="p-5 h-full group-hover:border-[#E8A020] transition-colors">
                <h3 className="font-bebas text-xl text-[#0A0F1E]">{s.label}</h3>
                <p className="text-sm text-[#4A4E5C] mt-1">{s.desc}</p>
              </Card>
            </Link>
          ))}
        </div>
      </PortalBody>
    </>
  );
}
