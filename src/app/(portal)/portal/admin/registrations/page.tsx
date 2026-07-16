import Link from "next/link";
import EmptyState from "@/components/ui/empty-state";
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
import {
  FilterBar,
  Pagination,
  filterSelectCls,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type { AdminRegistrationRow, RegistrationStatus, Rep } from "@/supabase/types";
import {
  bulkRegistrationDecision,
  resendActivation,
  setRegistrationStatus,
  syncAirtableRegistrations,
} from "../actions";

export const metadata = pageMetadata("Registrations", "Review and accept or decline entries.");
export const dynamic = "force-dynamic";

// Registration is now just the acceptance decision. Stage advancement and
// certificates live on the Participants hub, per edition.
const STATUSES: RegistrationStatus[] = ["submitted", "verified", "declined"];

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

// Checkboxes reference this form by id (the `form` attribute), so the bulk form
// never nests inside the per-row status forms.
const BULK_FORM_ID = "bulk-decisions";

const PAGE_SIZE = 20;

export default async function AdminRegistrations({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string; q?: string; status?: string; page?: string }>;
}) {
  const { edition, q, status, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, claim_code, contact_email, contact_name, onboarded_at, provisioned_count, reps, schools(name), profiles(email, full_name)",
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
  const needle = (q ?? "").trim().toLowerCase();
  const filtered = inEdition.filter((r) => {
    if (status && r.status !== status) return false;
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
    return haystack.some((v) => v?.toLowerCase().includes(needle));
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), pageCount);
  const registrations = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const listParams = { edition, q, status };

  return (
    <>
      <PortalHeader title="Registrations" subtitle="Review entries, resend activations, accept or decline" />
      <PortalBody>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <SectionHeading>
              {activeYear ? `${activeYear} edition` : "All editions"}
            </SectionHeading>
            {/* Airtable stays source of truth — this pulls its rows into the
                portal (idempotent; result arrives as a notification). */}
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
          </FilterBar>

          {/* Close-of-registration review: tick schools, then approve or decline
              the selection. Approve sends the guidelines email (and materialises
              the school's competition roster); decline sends a polite not-selected
              email. Neither touches portal access. Everything after acceptance —
              stage advancement, certificates — lives on the Participants hub. */}
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

          {registrations.length === 0 ? (
            <EmptyState title={needle || status ? "No matches" : "No registrations yet"}>
              {needle || status
                ? "No registrations match the current search or filter."
                : "Submitted registrations will appear here for review."}
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {registrations.map((r) => (
                <Card key={r.id} className="p-5 md:p-6 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        name="ids"
                        value={r.id}
                        form={BULK_FORM_ID}
                        aria-label={`Select ${r.schools?.name ?? "registration"}`}
                        className="mt-2 size-4 accent-primary shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bebas text-2xl text-foreground">
                          {r.schools?.name ?? "Unassigned school"}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {r.edition_year} ·{" "}
                          {r.profiles?.full_name ?? r.profiles?.email ?? r.contact_name ?? "Unclaimed"}
                          {r.contact_email ? ` · ${r.contact_email}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {r.profiles
                            ? `Coordinator active${r.provisioned_count != null ? ` · ${r.provisioned_count} students provisioned` : ""}`
                            : r.onboarded_at
                              ? "Onboarded — awaiting first sign-in"
                              : "Activation pending"}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  {Array.isArray(r.reps) && (r.reps as Rep[]).length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      <span className="uppercase tracking-[0.15em] text-[11px] font-bold">
                        Reps:{" "}
                      </span>
                      {(r.reps as Rep[])
                        .map((rep) =>
                          rep.level ? `${rep.name} (${rep.level})` : rep.name,
                        )
                        .join(", ")}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2">
                    <form
                      action={setRegistrationStatus.bind(null, r.id)}
                      className="flex gap-2"
                    >
                      <select
                        name="status"
                        defaultValue={r.status}
                        className={`${inputCls} capitalize`}
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="outline"
                        title="Change registration status?"
                        description="The school will be emailed if this moves to verified or declined."
                        confirmLabel="Yes, update"
                      >
                        Update status
                      </ConfirmSubmitButton>
                    </form>

                    {/* Resend / correct-email — only while the coordinator hasn't
                        activated yet. Regenerates the 30-day link. */}
                    {!r.profiles && !r.onboarded_at ? (
                      <form
                        action={resendActivation.bind(null, r.id)}
                        className="flex flex-wrap gap-2"
                      >
                        <input
                          name="email"
                          type="email"
                          required
                          defaultValue={r.contact_email ?? ""}
                          placeholder="coordinator@school.edu"
                          className={`${inputCls} w-64`}
                        />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          title="Send activation link?"
                          description="Regenerates the 30-day activation link and emails it to the address entered — the old link stops working."
                          confirmLabel="Yes, send"
                        >
                          Send activation link
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </Card>
              ))}
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
