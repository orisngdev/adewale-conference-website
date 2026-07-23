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
import { createClient } from "@/supabase/server";
import { getSessionUser, requireModuleView } from "@/supabase/auth";
import type { UserRole } from "@/supabase/types";

export const metadata = pageMetadata("Users", "Everyone with a portal account.");
export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

const PAGE_SIZE = 25;
const ROLES: UserRole[] = ["admin", "coordinator", "student"];

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  await requireModuleView("team");
  const { q, role, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const { from, to } = pageBounds(page, PAGE_SIZE);
  const supabase = await createClient();
  const user = await getSessionUser();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q?.trim()) {
    const escaped = q.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
    const ors = [`email.ilike.%${escaped}%`, `full_name.ilike.%${escaped}%`];
    // A 6-char query may be a student access code — resolve it so admins can
    // look a student up by the code in hand.
    if (/^[a-z0-9]{4,8}$/i.test(q.trim())) {
      const { data: codeHits } = await supabase
        .from("students")
        .select("auth_user_id")
        .ilike("access_code", q.trim())
        .limit(5);
      const ids = (codeHits ?? []).map((s) => s.auth_user_id).filter(Boolean);
      if (ids.length) ors.push(`id.in.(${ids.join(",")})`);
    }
    query = query.or(ors.join(","));
  }
  if (role) query = query.eq("role", role);

  const { data, count } = await query;
  const profiles = (data ?? []) as ProfileRow[];
  const total = count ?? profiles.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtering = Boolean(q?.trim() || role);

  // Student rows carry their access code + school (visible to admins only —
  // this page is admin-gated by the layout).
  const studentIds = profiles.filter((p) => p.role === "student").map((p) => p.id);
  const studentByAuthId = new Map<
    string,
    { access_code: string; level: string | null; school: string | null }
  >();
  if (studentIds.length) {
    const { data: studentRows } = await supabase
      .from("students")
      .select("auth_user_id, access_code, level, schools(name)")
      .is("deactivated_at", null)
      .in("auth_user_id", studentIds);
    for (const s of (studentRows ?? []) as unknown as {
      auth_user_id: string | null;
      access_code: string;
      level: string | null;
      schools: { name: string | null } | null;
    }[]) {
      if (s.auth_user_id) {
        studentByAuthId.set(s.auth_user_id, {
          access_code: s.access_code,
          level: s.level,
          school: s.schools?.name ?? null,
        });
      }
    }
  }

  return (
    <>
      <PortalHeader
        title="Users"
        subtitle="Everyone with a portal account. Invite admins from Settings."
      />
      <PortalBody>
        <div>
          <SectionHeading>{total} user{total === 1 ? "" : "s"}</SectionHeading>
          <FilterBar q={q} placeholder="Search name or email…">
            <select name="role" defaultValue={role ?? ""} className={filterSelectCls}>
              <option value="">Any role</option>
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </select>
          </FilterBar>
          {profiles.length === 0 ? (
            <EmptyState title={filtering ? "No matches" : "No users yet"}>
              {filtering
                ? "No users match the current search or filter."
                : "Users appear here after they sign in for the first time."}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <Card
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                >
                  <div>
                    <span className="text-foreground font-medium">
                      {p.full_name ?? p.email ?? "Unknown"}
                    </span>
                    {p.id === user?.id ? (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        you
                      </span>
                    ) : null}
                    {p.role === "student" && studentByAuthId.has(p.id) ? (
                      <p className="text-sm text-muted-foreground">
                        {[
                          studentByAuthId.get(p.id)?.school,
                          studentByAuthId.get(p.id)?.level,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        <span className="ml-2 inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold tracking-widest text-gold-ink">
                          {studentByAuthId.get(p.id)?.access_code}
                        </span>
                      </p>
                    ) : p.full_name && p.email ? (
                      <p className="text-sm text-muted-foreground">{p.email}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground capitalize">
                      {p.role}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/users"
            params={{ q, role }}
          />
        </div>
      </PortalBody>
    </>
  );
}
