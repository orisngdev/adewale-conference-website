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
      "id, edition_year, status, claim_code, schools(name), profiles(email, full_name), certificates(id, type)",
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
                      <span className="font-bebas text-2xl text-[#0A0F1E]">
                        {r.schools?.name ?? "Unassigned school"}
                      </span>
                      <p className="text-sm text-[#4A4E5C]">
                        {r.edition_year} ·{" "}
                        {r.profiles?.full_name ?? r.profiles?.email ?? "Unclaimed"}
                      </p>
                      {!r.profiles && r.claim_code ? (
                        <p className="text-xs mt-1">
                          <span className="text-[#4A4E5C]">Claim code: </span>
                          <span className="font-mono font-bold tracking-wider text-[#0A0F1E] bg-[rgba(232,160,32,0.14)] px-2 py-0.5">
                            {r.claim_code}
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>

                  <form
                    action={setRegistrationStatus.bind(null, r.id)}
                    className="flex gap-2"
                  >
                    <select
                      name="status"
                      defaultValue={r.status}
                      className="rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020] capitalize"
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

                  <div className="border-t border-[#0A0F1E]/5 pt-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#4A4E5C] mb-2">
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
                        className="flex-1 rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                      />
                      <input
                        name="asset_url"
                        placeholder="Asset URL (optional)"
                        className="flex-1 rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
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
