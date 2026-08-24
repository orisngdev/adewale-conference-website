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
  clampPage,
  pageBounds,
  parsePage,
} from "@/components/portal/list-controls";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import CopyLink from "@/components/portal/copy-link";
import { waitlistInviteUrl } from "@/lib/email";
import { INVITE_TOKEN_DAY_OPTIONS, INVITE_TOKEN_DAYS } from "@/lib/waitlist-invite";
import { pageMetadata } from "@/lib/seo";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { createClient } from "@/supabase/server";
import { inviteWaitlist, inviteWaitlistEntry } from "../actions";

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
  invite_token: string | null;
  invite_token_expires_at: string | null;
  invited_edition_year: number | null;
  invited_at: string | null;
  registration_id: string | null;
  converted_at: string | null;
}

const COLUMNS =
  "id, school_name, lga, category, contact_name, contact_email, phone, notified_at, created_at, invite_token, invite_token_expires_at, invited_edition_year, invited_at, registration_id, converted_at";

const shortDate = (value: string) => new Date(value).toLocaleDateString();

/** Waiting → invited (a live pass) → registered. An expired pass reads as
 * waiting again, because that's what the admin has to act on. */
function inviteState(entry: WaitlistRow) {
  if (entry.converted_at) return "registered" as const;
  if (
    entry.invite_token &&
    entry.invite_token_expires_at &&
    new Date(entry.invite_token_expires_at).getTime() > Date.now()
  ) {
    return "invited" as const;
  }
  return entry.invited_at ? ("lapsed" as const) : ("waiting" as const);
}

export default async function AdminWaitlist({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireModuleView("registrations");
  const canManage = await canManageModule("registrations");
  const { q, page: pageParam } = await searchParams;
  const requestedPage = parsePage(pageParam);
  const { from, to } = pageBounds(requestedPage, PAGE_SIZE);
  const supabase = await createClient();

  const buildQuery = () => {
    let query = supabase
      .from("waitlist")
      .select(COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false });
    if (q?.trim()) {
      const escaped = q.trim().replace(/[%_\\]/g, (m) => `\\${m}`);
      query = query.or(
        `school_name.ilike.%${escaped}%,contact_name.ilike.%${escaped}%,contact_email.ilike.%${escaped}%`,
      );
    }
    return query;
  };

  const [{ data, count }, { count: pendingCount }, { data: editionRows }] = await Promise.all([
    buildQuery().range(from, to),
    supabase.from("waitlist").select("id", { count: "exact", head: true }).is("notified_at", null),
    // Both, in one read: an invite admits into the open edition when there is
    // one, and otherwise into the newest — which is the whole point of invites.
    supabase.from("editions").select("year, registration_open").order("year", { ascending: false }),
  ]);

  const editions = (editionRows ?? []) as { year: number; registration_open: boolean }[];
  const inviteYear = editions.find((e) => e.registration_open)?.year ?? editions[0]?.year ?? null;

  let entries = (data ?? []) as WaitlistRow[];
  const total = count ?? entries.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = clampPage(requestedPage, pageCount);
  if (page !== requestedPage) {
    const clamped = pageBounds(page, PAGE_SIZE);
    const { data: pageData } = await buildQuery().range(clamped.from, clamped.to);
    entries = (pageData ?? []) as WaitlistRow[];
  }
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

          {/* Two different tools, and it matters which one you reach for: the
              card below announces an OPEN edition to everyone at once, while the
              per-row invite lets one named school in while registration is shut. */}
          {canManage && inviteYear ? (
            <p className="text-sm text-muted-foreground mb-4">
              Inviting a single school issues it a one-use link that works even while
              registration is closed. Invites admit into{" "}
              <span className="font-bold text-foreground">ASC {inviteYear}</span>.
            </p>
          ) : null}

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
              {entries.map((entry) => {
                const state = inviteState(entry);
                return (
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
                    {/* The live pass, in the open, so it can go out over WhatsApp
                        when a school's email bounces or is never read. */}
                    {state === "invited" && entry.invite_token ? (
                      <p className="mt-2">
                        <CopyLink url={waitlistInviteUrl(entry.invite_token)} />
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    {state === "registered" ? (
                      <a
                        href={
                          entry.registration_id
                            ? `/portal/admin/registrations/${entry.registration_id}`
                            : "/portal/admin/registrations"
                        }
                        className="inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      >
                        Registered
                      </a>
                    ) : state === "invited" ? (
                      <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary/10 text-gold-ink">
                        Invited{entry.invited_edition_year ? ` · ASC ${entry.invited_edition_year}` : ""}
                      </span>
                    ) : entry.notified_at ? (
                      <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] bg-primary/10 text-gold-ink">
                        Notified
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] bg-foreground/5 text-muted-foreground">
                        Waiting
                      </span>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {state === "registered" && entry.converted_at
                        ? `Registered ${shortDate(entry.converted_at)}`
                        : state === "invited" && entry.invite_token_expires_at
                          ? `Link expires ${shortDate(entry.invite_token_expires_at)}`
                          : state === "lapsed" && entry.invited_at
                            ? `Invite lapsed · sent ${shortDate(entry.invited_at)}`
                            : `Joined ${shortDate(entry.created_at)}`}
                    </p>

                    {canManage && state !== "registered" && inviteYear ? (
                      <form
                        action={inviteWaitlistEntry.bind(null, entry.id)}
                        className="flex items-center gap-2"
                      >
                        {/* How long the pass lives is a judgement call per school
                            — a week to chase a straggler before a cutoff, longer
                            for an early invite — so the admin sets it here. */}
                        <label className="sr-only" htmlFor={`expiry-${entry.id}`}>
                          Invite expires after
                        </label>
                        <select
                          id={`expiry-${entry.id}`}
                          name="expiresInDays"
                          defaultValue={INVITE_TOKEN_DAYS}
                          className="cursor-pointer rounded border border-foreground/10 bg-transparent px-2 py-1 text-xs text-muted-foreground"
                        >
                          {INVITE_TOKEN_DAY_OPTIONS.map((days) => (
                            <option key={days} value={days}>
                              {days} days
                            </option>
                          ))}
                        </select>
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          title={`Invite ${entry.school_name} to register?`}
                          description={`${entry.contact_email} is emailed a single-use link that lets this school register for ASC ${inviteYear}, valid for the period selected${
                            state === "waiting" ? "" : " — the previous link stops working"
                          }. Registration stays closed to everyone else.`}
                          confirmLabel="Yes, send the invite"
                        >
                          {state === "waiting" ? "Invite to register" : "Send a new link"}
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </div>
                );
              })}
            </Card>
          )}
          <Pagination page={page} pageCount={pageCount} path="/portal/admin/waitlist" params={{ q }} />
        </div>
      </PortalBody>
    </>
  );
}
