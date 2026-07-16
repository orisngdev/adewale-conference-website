import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import {
  FilterBar,
  Pagination,
  filterSelectCls,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type { RegistrationStatus } from "@/supabase/types";

export const metadata = pageMetadata("Participants", "Student reps and contacts per registration.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

// "Approved" = accepted into the competition (past the close-of-registration
// review). Matches the ACCEPTED set used on the Editions page.
const APPROVED: RegistrationStatus[] = ["verified", "qualified", "finalist"];

interface ParticipantRow {
  id: string;
  edition_year: number;
  status: RegistrationStatus;
  details: Record<string, string> | null;
  reps: { name: string; level?: string }[] | null;
  contact_email: string | null;
  schools: { name: string | null; lga: string | null; category: string | null } | null;
}

export default async function AdminParticipants({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edition?: string; page?: string }>;
}) {
  const { q, edition, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("registrations")
    .select("id, edition_year, status, details, reps, contact_email, schools(name, lga, category)")
    .in("status", APPROVED)
    .order("edition_year", { ascending: false })
    .order("created_at", { ascending: false });

  const all = (data ?? []) as unknown as ParticipantRow[];
  const years = [...new Set(all.map((r) => r.edition_year))].sort((a, b) => b - a);
  const activeYear = edition ? Number(edition) || null : null;

  const needle = (q ?? "").trim().toLowerCase();
  const filtered = all.filter((r) => {
    if (activeYear && r.edition_year !== activeYear) return false;
    if (!needle) return true;
    const d = r.details ?? {};
    const haystack = [
      r.schools?.name,
      r.contact_email,
      d["Principal Full Name"],
      d["Principal Email Address"],
      d["Teacher Full Name"],
      d["Teacher Email Address"],
      ...(Array.isArray(r.reps) ? r.reps.map((rep) => rep.name) : []),
    ];
    return haystack.some((v) => v?.toLowerCase().includes(needle));
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PortalHeader title="Participants" subtitle="Student reps and school contacts per registration" />
      <PortalBody>
        <div>
          <SectionHeading>
            {filtered.length} approved school{filtered.length === 1 ? "" : "s"}
          </SectionHeading>

          <FilterBar q={q} placeholder="Search school, email, rep, teacher, or principal…">
            <select name="edition" defaultValue={edition ?? ""} className={filterSelectCls}>
              <option value="">All editions</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FilterBar>

          {rows.length === 0 ? (
            <EmptyState title={needle || activeYear ? "No matches" : "No approved schools yet"}>
              {needle || activeYear
                ? "No approved schools match the current search or filter."
                : "Schools appear here once they're approved in Registrations at close of review."}
            </EmptyState>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {rows.map((r) => {
                const d = r.details ?? {};
                const reps = Array.isArray(r.reps) ? r.reps : [];
                return (
                  <div key={r.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-foreground">
                        {r.schools?.name ?? "—"}
                      </span>
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {[r.schools?.lga, r.schools?.category, r.edition_year]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {reps.length ? (
                      <p className="text-sm text-muted-foreground mt-1">
                        Reps:{" "}
                        {reps
                          .map((rep) => (rep.level ? `${rep.name} (${rep.level})` : rep.name))
                          .join(", ")}
                      </p>
                    ) : null}
                    {d["Teacher Full Name"] ? (
                      <p className="text-sm text-muted-foreground">
                        Teacher: {d["Teacher Full Name"]}
                        {d["Teacher Email Address"] ? ` · ${d["Teacher Email Address"]}` : ""}
                      </p>
                    ) : null}
                    {d["Principal Full Name"] ? (
                      <p className="text-sm text-muted-foreground">
                        Principal: {d["Principal Full Name"]}
                        {d["Principal Email Address"] ? ` · ${d["Principal Email Address"]}` : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </Card>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/participants"
            params={{ q, edition }}
          />
          <p className="text-xs text-muted-foreground mt-4">
            Shows only schools approved for the competition. Approve entries under{" "}
            <Link href="/portal/admin/registrations" className="text-primary hover:underline">
              Registrations
            </Link>
            .
          </p>
        </div>
      </PortalBody>
    </>
  );
}
