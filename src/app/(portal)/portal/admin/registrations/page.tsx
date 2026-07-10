import Link from "next/link";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatusBadge,
} from "@/components/portal/ui";
import { SubmitButton } from "@/components/portal/submit-button";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type {
  AdminRegistrationRow,
  RegistrationStatus,
  Rep,
} from "@/supabase/types";
import {
  bulkRegistrationDecision,
  issueCertificate,
  resendActivation,
  setRegistrationStatus,
} from "../actions";

export const metadata = pageMetadata("Registrations", "Review entries and issue certificates.");
export const dynamic = "force-dynamic";

const STATUSES: RegistrationStatus[] = [
  "submitted",
  "verified",
  "qualified",
  "finalist",
  "declined",
];

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

// Checkboxes reference this form by id (the `form` attribute), so the bulk form
// never nests inside the per-row status/certificate forms.
const BULK_FORM_ID = "bulk-decisions";

export default async function AdminRegistrations({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const { edition } = await searchParams;
  const supabase = await createClient();
  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, claim_code, contact_email, contact_name, onboarded_at, provisioned_count, reps, schools(name), profiles(email, full_name), certificates(id, type)",
    )
    .order("edition_year", { ascending: false });

  const all = (regData ?? []) as unknown as AdminRegistrationRow[];
  const years = [...new Set(all.map((r) => r.edition_year))].sort((a, b) => b - a);
  // Default to the newest edition — the close-of-registration review works one
  // edition at a time.
  const activeYear = edition === "all" ? null : Number(edition) || years[0] || null;
  const registrations = activeYear ? all.filter((r) => r.edition_year === activeYear) : all;
  const underReview = registrations.filter((r) => r.status === "submitted").length;

  return (
    <>
      <PortalHeader title="Registrations" subtitle="Review entries, resend activations, issue certificates" />
      <PortalBody>
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
            <SectionHeading>
              {activeYear ? `${activeYear} edition` : "All editions"}
            </SectionHeading>
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

          {/* Close-of-registration review: tick schools, then approve or decline
              the selection. Approve sends the guidelines email; decline sends a
              polite not-selected email. Neither touches portal access. */}
          <form id={BULK_FORM_ID} action={bulkRegistrationDecision}>
            <Card className="p-4 mb-6 flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1 min-w-40">
                <span className="font-bold text-foreground">{underReview}</span> under
                review — select schools below, then:
              </p>
              <SubmitButton name="decision" value="approve" size="sm" pendingText="Approving…">
                Approve selected
              </SubmitButton>
              <SubmitButton name="decision" value="decline" size="sm" variant="outline" pendingText="Declining…">
                Decline selected
              </SubmitButton>
            </Card>
          </form>

          {registrations.length === 0 ? (
            <EmptyState title="No registrations yet">
              Submitted registrations will appear here for review.
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
                      <Button type="submit" size="sm" variant="outline">
                        Update status
                      </Button>
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
                        <SubmitButton size="sm" variant="outline" pendingText="Sending…">
                          Send activation link
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>

                  <div className="border-t border-foreground/5 pt-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">
                      Certificates
                      {r.certificates.length
                        ? `: ${r.certificates.map((c) => c.type ?? "—").join(", ")}`
                        : ""}
                    </p>
                    <form
                      action={issueCertificate.bind(null, r.id)}
                      className="flex flex-col sm:flex-row gap-2"
                    >
                      <input
                        name="type"
                        required
                        placeholder="Certificate type (e.g. Finalist)"
                        className={`flex-1 ${inputCls}`}
                      />
                      <input
                        name="asset_url"
                        placeholder="Asset URL (optional)"
                        className={`flex-1 ${inputCls}`}
                      />
                      <Button type="submit" size="sm">
                        Issue
                      </Button>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PortalBody>
    </>
  );
}
