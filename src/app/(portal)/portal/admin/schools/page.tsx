import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { approveMembership, rejectMembership } from "./actions";

export const metadata = pageMetadata("Schools", "Schools and access requests.");
export const dynamic = "force-dynamic";

interface SchoolRow {
  id: string;
  name: string;
  lga: string | null;
  category: string | null;
  registrations: { count: number }[];
}

interface PendingMember {
  id: string;
  email: string;
  schools: { name: string | null } | null;
}

export default async function AdminSchools() {
  const supabase = await createClient();
  const [{ data: schoolData }, { data: pendingData }] = await Promise.all([
    supabase
      .from("schools")
      .select("id, name, lga, category, registrations(count)")
      .order("name", { ascending: true }),
    supabase
      .from("school_members")
      .select("id, email, schools(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const schools = (schoolData ?? []) as unknown as SchoolRow[];
  const pending = (pendingData ?? []) as unknown as PendingMember[];

  return (
    <>
      <PortalHeader title="Schools" subtitle="Access requests and registered schools" />
      <PortalBody>
        <div>
          <SectionHeading>
            Pending access {pending.length > 0 ? `(${pending.length})` : ""}
          </SectionHeading>
          {pending.length === 0 ? (
            <p className="serif-display italic text-[#4A4E5C]">
              No access requests awaiting approval.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((m) => (
                <Card
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                >
                  <div>
                    <span className="font-medium text-[#0A0F1E]">
                      {m.schools?.name ?? "Unknown school"}
                    </span>
                    <p className="text-sm text-[#4A4E5C]">{m.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveMembership.bind(null, m.id)}>
                      <Button type="submit" size="sm">
                        Approve
                      </Button>
                    </form>
                    <form action={rejectMembership.bind(null, m.id)}>
                      <Button type="submit" size="sm" variant="outline">
                        Reject
                      </Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>
            {schools.length} school{schools.length === 1 ? "" : "s"}
          </SectionHeading>
          {schools.length === 0 ? (
            <EmptyState title="No schools yet">
              Schools are created when registrations are linked in the portal.
            </EmptyState>
          ) : (
            <Card className="divide-y divide-[#0A0F1E]/5">
              {schools.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <span className="font-medium text-[#0A0F1E]">{s.name}</span>
                    <p className="text-sm text-[#4A4E5C]">
                      {[s.lga, s.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="text-sm text-[#4A4E5C] whitespace-nowrap">
                    {s.registrations?.[0]?.count ?? 0} registration
                    {(s.registrations?.[0]?.count ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </PortalBody>
    </>
  );
}
