import Link from "next/link";
import { Eye, FileSpreadsheet, Mail, Sheet, Users } from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatusBadge,
} from "@/components/portal/ui";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { ConfirmDecisionButton } from "@/components/portal/confirm-decision-button";
import { SelectAllCheckbox } from "@/components/portal/select-all-checkbox";
import { SelectAllMatching } from "@/components/portal/select-all-matching";
import { genderMix } from "@/components/portal/registration-details";
import {
  FilterBar,
  Pagination,
  filterSelectCls,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { searchHaystackMatches, searchTokens } from "@/lib/search";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import type { AdminRegistrationRow, RegistrationStatus, Rep } from "@/supabase/types";
import {
  bulkRegistrationDecision,
  syncAirtableRegistrations,
} from "../actions";

export const metadata = pageMetadata("Registrations", "Review and accept or decline entries.");
export const dynamic = "force-dynamic";

// Registration is now just the acceptance decision. Stage advancement and
// certificates live on the Participants hub, per edition.
const STATUSES: RegistrationStatus[] = ["submitted", "verified", "declined"];
const ACTIVATION_FILTERS = ["pending", "onboarded", "active"] as const;
type ActivationFilter = (typeof ACTIVATION_FILTERS)[number];

// Checkboxes reference this form by id (the `form` attribute), so the bulk form
// never nests inside the per-row status forms.
const BULK_FORM_ID = "bulk-decisions";

const PAGE_SIZE = 20;

export default async function AdminRegistrations({
  searchParams,
}: {
  searchParams: Promise<{
    edition?: string;
    q?: string;
    status?: string;
    activation?: string;
    page?: string;
  }>;
}) {
  await requireModuleView("registrations");
  const canManage = await canManageModule("registrations");
  const { edition, q, status, activation, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, claim_code, contact_email, contact_name, onboarded_at, provisioned_count, reps, details, schools(name), profiles(email, full_name)",
    )
    .order("edition_year", { ascending: false })
    .order("created_at", { ascending: false });

  const all = (regData ?? []) as unknown as AdminRegistrationRow[];
  const years = [...new Set(all.map((r) => r.edition_year))].sort((a, b) => b - a);
  // Default to the newest edition — the close-of-registration review works one
  // edition at a time.
  const activeYear = edition === "all" ? null : Number(edition) || years[0] || null;
  const inEdition = activeYear ? all.filter((r) => r.edition_year === activeYear) : all;
  const underReview = inEdition.filter((r) => r.status === "submitted").length;

  // Search matches school, contact, coordinator, and reps; status narrows the
  // review queue. Both apply within the active edition tab.
  const needle = searchTokens(q).join(" ");
  const activationFilter = ACTIVATION_FILTERS.includes(
    activation as ActivationFilter,
  )
    ? (activation as ActivationFilter)
    : undefined;
  const filtered = inEdition.filter((r) => {
    if (status && r.status !== status) return false;
    if (activationFilter === "pending" && (r.profiles || r.onboarded_at)) return false;
    if (activationFilter === "onboarded" && (r.profiles || !r.onboarded_at)) return false;
    if (activationFilter === "active" && !r.profiles) return false;
    if (!needle) return true;
    const haystack = [
      r.schools?.name,
      r.contact_email,
      r.contact_name,
      r.profiles?.email,
      r.profiles?.full_name,
      r.claim_code,
      ...(Array.isArray(r.reps) ? (r.reps as Rep[]).map((rep) => rep.name) : []),
    ];
    return searchHaystackMatches(haystack, q);
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), pageCount);
  const registrations = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const listParams = { edition, q, status, activation: activationFilter };
  const hasActiveFilter = Boolean(needle || status || activationFilter);
  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [s, inEdition.filter((r) => r.status === s).length]),
  ) as Record<RegistrationStatus, number>;

  return (
    <>
      <PortalHeader title="Registrations" subtitle="Review entries, resend activations, accept or decline" />
      <PortalBody>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <SectionHeading>
              {activeYear ? `${activeYear} edition` : "All editions"}
            </SectionHeading>
            <div className="flex flex-wrap items-center gap-2">
              {/* Export the current edition scope. CSV opens straight into Google
                  Sheets; XLSX is a real Excel workbook. A read, so read-only
                  admins can export too. */}
              <a
                href={`/portal/admin/registrations/export?format=csv&edition=${activeYear ?? "all"}`}
                className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary"
              >
                <Sheet className="size-4" strokeWidth={2} />
                Google Sheets (CSV)
              </a>
              <a
                href={`/portal/admin/registrations/export?format=xlsx&edition=${activeYear ?? "all"}`}
                className="inline-flex items-center gap-2 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary"
              >
                <FileSpreadsheet className="size-4" strokeWidth={2} />
                Excel (.xlsx)
              </a>
              {/* Airtable stays source of truth — this pulls its rows into the
                  portal (idempotent; result arrives as a notification). */}
              {canManage ? (
                <form action={syncAirtableRegistrations}>
                  <ConfirmSubmitButton
                    size="sm"
                    variant="outline"
                    title="Sync from Airtable?"
                    description="Pulls every school and registration from Airtable into the portal — new rows are added, edited rows refreshed. No emails are sent. The result arrives as a notification."
                    confirmLabel="Yes, sync"
                  >
                    Sync from Airtable
                  </ConfirmSubmitButton>
                </form>
              ) : (
                <ReadOnlyBadge />
              )}
            </div>
          </div>

          {years.length > 1 || edition === "all" ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {years.map((y) => (
                <Link
                  key={y}
                  href={`/portal/admin/registrations?edition=${y}`}
                  className={`px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                    activeYear === y
                      ? "bg-primary/15 text-gold-ink"
                      : "bg-foreground/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {y}
                </Link>
              ))}
              <Link
                href="/portal/admin/registrations?edition=all"
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                  activeYear === null
                    ? "bg-primary/15 text-gold-ink"
                    : "bg-foreground/5 text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </Link>
            </div>
          ) : null}

          <FilterBar
            q={q}
            placeholder="Search school, email, contact, rep, or claim code…"
            preserve={{ edition }}
          >
            <select name="status" defaultValue={status ?? ""} className={filterSelectCls}>
              <option value="">Any status</option>
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">
                  {s}
                </option>
              ))}
            </select>
            <select
              name="activation"
              defaultValue={activationFilter ?? ""}
              className={filterSelectCls}
            >
              <option value="">Any activation</option>
              <option value="pending">Pending activation</option>
              <option value="onboarded">Onboarded, awaiting sign-in</option>
              <option value="active">Coordinator active</option>
            </select>
          </FilterBar>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {STATUSES.map((s) => (
              <div key={s} className="border border-foreground/10 bg-card px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {s}
                </p>
                <p className="mt-1 font-bebas text-3xl leading-none text-foreground">
                  {statusCounts[s]}
                </p>
              </div>
            ))}
          </div>

          {/* Close-of-registration review: tick schools, then approve or decline
              the selection. Approve sends the guidelines email (and materialises
              the school's competition roster); decline sends a polite not-selected
              email. Neither touches portal access. Everything after acceptance —
              stage advancement, certificates — lives on the Participants hub. */}
          {canManage ? (
          <form id={BULK_FORM_ID} action={bulkRegistrationDecision}>
            <Card className="p-4 mb-6 space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <SelectAllCheckbox formId={BULK_FORM_ID} targetName="ids" />
                {filtered.length > registrations.length ? (
                  <SelectAllMatching
                    formId={BULK_FORM_ID}
                    ids={filtered.map((r) => r.id)}
                  />
                ) : null}
                <p className="text-sm text-muted-foreground flex-1 min-w-40">
                  <span className="font-bold text-foreground">{underReview}</span> under
                  review · <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                  match{filtered.length === 1 ? "" : "es"} — select schools below, then:
                </p>
                <ConfirmDecisionButton
                  name="decision"
                  value="approve"
                  size="sm"
                  title="Approve selected schools?"
                  description="Every ticked school is approved, sent the guidelines email, and its reps become the school's competition roster."
                  confirmLabel="Yes, approve"
                >
                  Approve selected
                </ConfirmDecisionButton>
                <ConfirmDecisionButton
                  name="decision"
                  value="decline"
                  size="sm"
                  variant="outline"
                  destructive
                  title="Decline selected schools?"
                  description="Every ticked school is declined and sent a polite not-selected email."
                  confirmLabel="Yes, decline"
                >
                  Decline selected
                </ConfirmDecisionButton>
              </div>
            </Card>
          </form>
          ) : null}

          {registrations.length === 0 ? (
            <EmptyState title={hasActiveFilter ? "No matches" : "No registrations yet"}>
              {hasActiveFilter
                ? "No registrations match the current search or filter."
                : "Submitted registrations will appear here for review."}
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {registrations.map((r) => {
                const reps = Array.isArray(r.reps) ? (r.reps as Rep[]) : [];
                const mix = genderMix(r.details);
                const activationLabel = r.profiles
                  ? "Coordinator active"
                  : r.onboarded_at
                    ? "Onboarded, awaiting sign-in"
                    : "Activation pending";

                return (
                  <Card key={r.id} className="p-4">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)_minmax(170px,0.8fr)_auto] lg:items-center">
                      <div className="flex items-start gap-3 min-w-0">
                        {canManage ? (
                          <input
                            type="checkbox"
                            name="ids"
                            value={r.id}
                            form={BULK_FORM_ID}
                            aria-label={`Select ${r.schools?.name ?? "registration"}`}
                            className="mt-1 size-4 accent-primary shrink-0"
                          />
                        ) : null}
                        <div className="min-w-0">
                          <Link
                            href={`/portal/admin/registrations/${r.id}`}
                            className="font-bebas text-2xl leading-none text-foreground hover:text-primary"
                          >
                            {r.schools?.name ?? "Unassigned school"}
                          </Link>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            <span>{r.edition_year} edition</span>
                            <span className="inline-flex items-center gap-1 min-w-0">
                              <Mail className="size-3.5" />
                              <span className="truncate">
                                {r.contact_email ?? "No coordinator email"}
                              </span>
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="min-w-0 text-sm text-muted-foreground">
                        <p className="font-medium text-foreground truncate">
                          {r.profiles?.full_name ??
                            r.profiles?.email ??
                            r.contact_name ??
                            "Unclaimed"}
                        </p>
                        <p className="mt-0.5">{activationLabel}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3.5" />
                          {reps.length} rep{reps.length === 1 ? "" : "s"}
                        </span>
                        {mix ? (
                          <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                            {mix}
                          </span>
                        ) : null}
                        {r.provisioned_count != null ? (
                          <span>{r.provisioned_count} provisioned</span>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        <StatusBadge status={r.status} />
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/portal/admin/registrations/${r.id}`}>
                            <Eye className="size-4" />
                            Details
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/registrations"
            params={listParams}
          />
        </div>
      </PortalBody>
    </>
  );
}
