import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatTile,
  StatusBadge,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { isSupabaseConfigured } from "@/supabase/env";
import type { Rep, RegistrationWithRelations } from "@/supabase/types";
import { sanityFetch } from "@/sanity/lib/live";
import { resultsBySchoolQuery } from "@/sanity/lib/queries";
import type { ResultRow } from "@/sanity/types";
import ClaimForm from "@/components/portal/claim-form";
import { addRep, removeRep } from "./actions";

export const metadata = pageMetadata(
  "School dashboard",
  "Manage your school's reps, registration, and results.",
);
export const dynamic = "force-dynamic";

export default async function SchoolDashboard() {
  if (!isSupabaseConfigured) redirect("/portal/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, reps, schools(name, lga), certificates(id, type, asset_url)",
    )
    .eq("owner_id", user.id)
    .order("edition_year", { ascending: false });

  const registrations = (regData ?? []) as unknown as RegistrationWithRelations[];
  const schoolName =
    registrations.find((r) => r.schools?.name)?.schools?.name ?? null;
  const totalReps = registrations.reduce(
    (n, r) => n + (Array.isArray(r.reps) ? (r.reps as Rep[]).length : 0),
    0,
  );

  const { data: resultData } = schoolName
    ? await sanityFetch({
        query: resultsBySchoolQuery,
        params: { school: schoolName },
      })
    : { data: [] };
  const results = (resultData ?? []) as ResultRow[];

  return (
    <>
      <PortalHeader
        title={schoolName ?? "Your school"}
        subtitle="Manage your representatives and track results"
      />
      <PortalBody>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Registrations" value={registrations.length} />
          <StatTile label="Representatives" value={totalReps} />
          <StatTile label="Results" value={results.length} />
          <StatTile
            label="Latest status"
            value={registrations[0]?.status ?? "—"}
          />
        </div>

        <div>
          <SectionHeading>Claim a registration</SectionHeading>
          <Card className="p-5 md:p-6">
            <p className="serif-display italic text-[#4A4E5C] mb-4">
              Have a claim code from your registration confirmation? Enter it to
              link your school to this account.
            </p>
            <ClaimForm />
          </Card>
        </div>

        <div>
          <SectionHeading>Registrations &amp; representatives</SectionHeading>
          {registrations.length === 0 ? (
            <>
              <EmptyState title="No registration yet">
                Your school&apos;s registration will appear here once it&apos;s
                submitted.
              </EmptyState>
              <div className="mt-4 text-center">
                <Button asChild>
                  <Link href="/#register">Register a school</Link>
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {registrations.map((r) => {
                const reps = Array.isArray(r.reps) ? (r.reps as Rep[]) : [];
                return (
                  <Card key={r.id} className="p-5 md:p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-bebas text-2xl text-[#0A0F1E]">
                        {r.edition_year} edition
                      </span>
                      <StatusBadge status={r.status} />
                    </div>

                    <ul className="space-y-2">
                      {reps.length === 0 ? (
                        <li className="text-sm text-[#4A4E5C]">
                          No representatives added yet.
                        </li>
                      ) : (
                        reps.map((rep, i) => (
                          <li
                            key={`${rep.name}-${i}`}
                            className="flex items-center justify-between border-b border-[#0A0F1E]/5 pb-2"
                          >
                            <span className="text-[#0A0F1E]">
                              {rep.name}
                              {rep.level ? (
                                <span className="text-[#4A4E5C]"> · {rep.level}</span>
                              ) : null}
                            </span>
                            <form action={removeRep.bind(null, r.id, i)}>
                              <button
                                type="submit"
                                className="text-xs uppercase tracking-wide text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            </form>
                          </li>
                        ))
                      )}
                    </ul>

                    <form
                      action={addRep.bind(null, r.id)}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        name="name"
                        required
                        placeholder="Representative name"
                        className="flex-1 rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                      />
                      <input
                        name="level"
                        placeholder="Class (e.g. SS2)"
                        className="sm:w-40 rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                      />
                      <Button type="submit" size="sm">
                        Add rep
                      </Button>
                    </form>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>School results</SectionHeading>
          {results.length === 0 ? (
            <p className="serif-display italic text-[#4A4E5C]">
              Your school&apos;s past results will appear here once published.
            </p>
          ) : (
            <Card className="divide-y divide-[#0A0F1E]/5">
              {results.map((res) => (
                <div
                  key={res._id}
                  className="flex items-center justify-between p-4"
                >
                  <div>
                    <span className="font-medium text-[#0A0F1E]">
                      {res.category}
                    </span>
                    <span className="text-sm text-[#4A4E5C]"> · {res.year}</span>
                    {res.studentNames?.length ? (
                      <p className="text-sm text-[#4A4E5C]">
                        {res.studentNames.join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {res.position ? <StatusBadge status={res.position} /> : null}
                </div>
              ))}
            </Card>
          )}
        </div>

        <div>
          <SectionHeading action={{ href: "/resources", label: "Open hub →" }}>
            Materials
          </SectionHeading>
          <p className="serif-display italic text-[#4A4E5C]">
            Preparation materials and past questions live in the Resources hub.
          </p>
        </div>
      </PortalBody>
    </>
  );
}
