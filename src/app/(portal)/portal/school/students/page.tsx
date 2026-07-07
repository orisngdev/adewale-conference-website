import { redirect } from "next/navigation";
import { Card, SectionHeading } from "@/components/portal/ui";
import ProvisionRepButton from "@/components/portal/provision-rep-button";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Rep, RegistrationWithRelations } from "@/supabase/types";

export const metadata = pageMetadata("Students", "Provision access codes for your representatives.");
export const dynamic = "force-dynamic";

export default async function SchoolStudents() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data: regData } = await supabase
    .from("registrations")
    .select("id, edition_year, reps")
    .order("edition_year", { ascending: false });
  const registrations = (regData ?? []) as unknown as RegistrationWithRelations[];

  const { data: studentData } = await supabase
    .from("students")
    .select("name, level, access_code");
  const students = (studentData ?? []) as {
    name: string;
    level: string | null;
    access_code: string;
  }[];
  const studentByName = new Map(students.map((s) => [s.name.toLowerCase(), s]));

  return (
    <div>
      <SectionHeading>Students</SectionHeading>
      <p className="serif-display italic text-muted-foreground mb-5">
        Each representative on a registration can get an access code — they sign
        in to the portal with just the code (no email). Students are your
        registered representatives; to change the team, edit the registration.
      </p>

      {students.length > 0 ? (
        <Card className="p-5 md:p-6 mb-6">
          <p className="font-bebas text-xl text-foreground mb-3">
            Your students ({students.length})
          </p>
          <div className="divide-y divide-foreground/5 border border-foreground/10">
            {students.map((s) => (
              <div key={s.access_code} className="flex items-center justify-between gap-4 p-3">
                <span className="text-foreground">
                  {s.name}
                  {s.level ? <span className="text-muted-foreground"> · {s.level}</span> : null}
                </span>
                <span className="text-xs font-mono bg-foreground/5 px-2 py-1 rounded text-muted-foreground">
                  code: {s.access_code}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {registrations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No registrations yet — register for an edition to add representatives.
        </p>
      ) : (
        <div className="space-y-6">
          {registrations.map((r) => {
            const reps = Array.isArray(r.reps) ? (r.reps as Rep[]) : [];
            return (
              <Card key={r.id} className="p-5 md:p-6">
                <p className="font-bebas text-xl text-foreground mb-3">
                  {r.edition_year} edition
                </p>
                {reps.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No representatives on this registration.
                  </p>
                ) : (
                  <div className="divide-y divide-foreground/5 border border-foreground/10">
                    {reps.map((rep, i) => {
                      const student = studentByName.get(rep.name.toLowerCase());
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-4 p-3"
                        >
                          <span className="text-foreground">
                            {rep.name}
                            {rep.level ? (
                              <span className="text-muted-foreground"> · {rep.level}</span>
                            ) : null}
                          </span>
                          <ProvisionRepButton
                            name={rep.name}
                            level={rep.level ?? null}
                            existingCode={student?.access_code}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
