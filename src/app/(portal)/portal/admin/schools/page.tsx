import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
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
  pageBounds,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { LGA_OPTIONS, SCHOOL_CATEGORY_OPTIONS } from "@/lib/forms";
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

const PAGE_SIZE = 30;

export default async function AdminSchools({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; lga?: string; category?: string; page?: string }>;
}) {
  const { q, lga, category, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const { from, to } = pageBounds(page, PAGE_SIZE);
  const supabase = await createClient();

  // Search + filters run in the database — the schools list is 500+ rows.
  let schoolsQuery = supabase
    .from("schools")
    .select("id, name, lga, category, registrations(count)", { count: "exact" })
    .order("name", { ascending: true })
    .range(from, to);
  if (q?.trim()) {
    const escaped = q.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
    schoolsQuery = schoolsQuery.ilike("name", `%${escaped}%`);
  }
  if (lga) schoolsQuery = schoolsQuery.eq("lga", lga);
  if (category) schoolsQuery = schoolsQuery.eq("category", category);

  const [{ data: schoolData, count }, { data: pendingData }] = await Promise.all([
    schoolsQuery,
    supabase
      .from("school_members")
      .select("id, email, schools(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
  ]);

  const schools = (schoolData ?? []) as unknown as SchoolRow[];
  const pending = (pendingData ?? []) as unknown as PendingMember[];
  const total = count ?? schools.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtering = Boolean(q?.trim() || lga || category);

  return (
    <>
      <PortalHeader title="Schools" subtitle="Access requests and registered schools" />
      <PortalBody>
        <div>
          <SectionHeading>
            Pending access {pending.length > 0 ? `(${pending.length})` : ""}
          </SectionHeading>
          {pending.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">
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
                    <span className="font-medium text-foreground">
                      {m.schools?.name ?? "Unknown school"}
                    </span>
                    <p className="text-sm text-muted-foreground">{m.email}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={approveMembership.bind(null, m.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        title="Approve this access request?"
                        description={`${m.email} gets educator access to ${m.schools?.name ?? "this school"}.`}
                        confirmLabel="Yes, approve"
                      >
                        Approve
                      </ConfirmSubmitButton>
                    </form>
                    <form action={rejectMembership.bind(null, m.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="outline"
                        destructive
                        title="Reject this access request?"
                        description={`${m.email} will not get access to ${m.schools?.name ?? "this school"}.`}
                        confirmLabel="Yes, reject"
                      >
                        Reject
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>
            {total} school{total === 1 ? "" : "s"}
          </SectionHeading>
          <FilterBar q={q} placeholder="Search school name…">
            <select name="lga" defaultValue={lga ?? ""} className={filterSelectCls}>
              <option value="">Any LGA</option>
              {LGA_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select name="category" defaultValue={category ?? ""} className={filterSelectCls}>
              <option value="">Any category</option>
              {SCHOOL_CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </FilterBar>
          {schools.length === 0 ? (
            <EmptyState title={filtering ? "No matches" : "No schools yet"}>
              {filtering
                ? "No schools match the current search or filter."
                : "Schools are created when registrations are linked in the portal."}
            </EmptyState>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {schools.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <span className="font-medium text-foreground">{s.name}</span>
                    <p className="text-sm text-muted-foreground">
                      {[s.lga, s.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {s.registrations?.[0]?.count ?? 0} registration
                    {(s.registrations?.[0]?.count ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </Card>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/schools"
            params={{ q, lga, category }}
          />
        </div>
      </PortalBody>
    </>
  );
}
