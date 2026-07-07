import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatusBadge,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type {
  AdminRegistrationRow,
  RegistrationStatus,
  Rep,
} from "@/supabase/types";
import { issueCertificate, setRegistrationStatus } from "../actions";

export const metadata = pageMetadata("Registrations", "Verify registrations and issue certificates.");
export const dynamic = "force-dynamic";

const STATUSES: RegistrationStatus[] = [
  "submitted",
  "verified",
  "qualified",
  "finalist",
];

export default async function AdminRegistrations() {
  const supabase = await createClient();
  const { data: regData } = await supabase
    .from("registrations")
    .select(
      "id, edition_year, status, claim_code, reps, schools(name), profiles(email, full_name), certificates(id, type)",
    )
    .order("edition_year", { ascending: false });

  const registrations = (regData ?? []) as unknown as AdminRegistrationRow[];

  return (
    <>
      <PortalHeader title="Registrations" subtitle="Verify status and issue certificates" />
      <PortalBody>
        <div>
          <SectionHeading>All registrations</SectionHeading>
          {registrations.length === 0 ? (
            <EmptyState title="No registrations yet">
              Submitted registrations will appear here for verification.
            </EmptyState>
          ) : (
            <div className="space-y-6">
              {registrations.map((r) => (
                <Card key={r.id} className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bebas text-2xl text-foreground">
                        {r.schools?.name ?? "Unassigned school"}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {r.edition_year} ·{" "}
                        {r.profiles?.full_name ?? r.profiles?.email ?? "Unclaimed"}
                      </p>
                      {!r.profiles && r.claim_code ? (
                        <p className="text-xs mt-1">
                          <span className="text-muted-foreground">Claim code: </span>
                          <span className="font-mono font-bold tracking-wider text-foreground bg-primary/[0.14] px-2 py-0.5">
                            {r.claim_code}
                          </span>
                        </p>
                      ) : null}
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

                  <form
                    action={setRegistrationStatus.bind(null, r.id)}
                    className="flex gap-2"
                  >
                    <select
                      name="status"
                      defaultValue={r.status}
                      className="rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary capitalize"
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
                        className="flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                      />
                      <input
                        name="asset_url"
                        placeholder="Asset URL (optional)"
                        className="flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
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
