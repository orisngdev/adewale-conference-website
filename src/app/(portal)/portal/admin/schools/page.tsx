import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";

export const metadata = pageMetadata("Schools", "Schools registered in the portal.");
export const dynamic = "force-dynamic";

interface SchoolRow {
  id: string;
  name: string;
  lga: string | null;
  category: string | null;
  registrations: { count: number }[];
}

export default async function AdminSchools() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schools")
    .select("id, name, lga, category, registrations(count)")
    .order("name", { ascending: true });

  const schools = (data ?? []) as unknown as SchoolRow[];

  return (
    <>
      <PortalHeader title="Schools" subtitle="Schools created through portal registrations" />
      <PortalBody>
        <div>
          <SectionHeading>{schools.length} school{schools.length === 1 ? "" : "s"}</SectionHeading>
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
