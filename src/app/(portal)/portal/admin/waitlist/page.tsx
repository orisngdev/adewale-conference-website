import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  FilterBar,
  Pagination,
  pageBounds,
  parsePage,
} from "@/components/portal/list-controls";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { pageMetadata } from "@/lib/seo";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { createClient } from "@/supabase/server";
import { inviteWaitlist } from "../actions";

export const metadata = pageMetadata("Waitlist", "Schools waiting for registration to open.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

interface WaitlistRow {
  id: string;
  school_name: string;
  lga: string | null;
  category: string | null;
  contact_name: string;
  contact_email: string;
  phone: string | null;
  notified_at: string | null;
  created_at: string;
}

export default async function AdminWaitlist({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireModuleView("registrations");
  const canManage = await canManageModule("registrations");
  const { q, page: pageParam } = await searchParams;
  const page = parsePage(pageParam);
  const { from, to } = pageBounds(page, PAGE_SIZE);
  const supabase = await createClient();

  let query = supabase
    .from("waitlist")
    .select("id, school_name, lga, category, contact_name, contact_email, phone, notified_at, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q?.trim()) {
    const escaped = q.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
    query = query.or(
      `school_name.ilike.%${escaped}%,contact_name.ilike.%${escaped}%,contact_email.ilike.%${escaped}%`,
    );
  }

  const [{ data, count }, { count: pendingCount }] = await Promise.all([
    query,
    supabase.from("waitlist").select("id", { count: "exact", head: true }).is("notified_at", null),
  ]);

  const entries = (data ?? []) as WaitlistRow[];
  const total = count ?? entries.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pending = pendingCount ?? 0;

  return (
    <>
      <PortalHeader
        title="Waitlist"
        subtitle="Schools that asked to be told when registration opens"
      />
      <PortalBody>
        {!canManage ? <ReadOnlyBadge /> : null}
        <div>
          <SectionHeading>
            {total} school{total === 1 ? "" : "s"} waiting
          </SectionHeading>

          {/* One-click announce: emails every un-notified entry the open
              registration link. Requires an open edition; never double-sends. */}
          {canManage ? (
            <form action={inviteWaitlist}>
              <Card className="p-4 mb-4 flex flex-wrap items-center gap-3">
                <p className="text-sm text-muted-foreground flex-1 min-w-40">
                  <span className="font-bold text-foreground">{pending}</span> not yet
                  notified — when registration opens:
                </p>
                <ConfirmSubmitButton
                  size="sm"
                  title="Invite the waitlist?"
                  description={`${pending} school(s) are emailed the registration link for the open edition. Already-notified entries are skipped.`}
                  confirmLabel="Yes, send invites"
                >
                  Invite waitlist
                </ConfirmSubmitButton>
              </Card>
            </form>
          ) : null}

          <FilterBar q={q} placeholder="Search school, contact, or email…" />

          {entries.length === 0 ? (
            <EmptyState title={q ? "No matches" : "No one waiting yet"}>
              {q
                ? "No waitlist entries match the current search."
                : "When registration is closed, schools can join the waitlist from the homepage."}
            </EmptyState>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {entries.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{entry.school_name}</span>
                    <p className="text-sm text-muted-foreground">
                      {[entry.lga, entry.category].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.contact_name} · {entry.contact_email}
                      {entry.phone ? ` · ${entry.phone}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {entry.notified_at ? (
                      <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary/10 text-gold-ink">
                        Notified
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] bg-foreground/5 text-muted-foreground">
                        Waiting
                      </span>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Joined {new Date(entry.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </Card>
          )}
          <Pagination page={page} pageCount={pageCount} path="/portal/admin/waitlist" params={{ q }} />
        </div>
      </PortalBody>
    </>
  );
}
