import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatusBadge,
} from "@/components/portal/ui";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import type { InfoChangeRequestRow } from "@/supabase/types";
import { approveInfoChange, declineInfoChange } from "./actions";

export const metadata = pageMetadata(
  "Contact corrections",
  "Educator/principal detail corrections requested by schools.",
);
export const dynamic = "force-dynamic";

const TARGET_LABEL: Record<InfoChangeRequestRow["target"], string> = {
  teacher: "Educator",
  principal: "Principal",
};

export default async function AdminInfoChanges() {
  await requireModuleView("registrations");
  const canManage = await canManageModule("registrations");

  const supabase = await createClient();

  // RLS (icr_read) returns all rows to admins.
  const { data } = await supabase
    .from("info_change_requests")
    .select(
      "id, registration_id, school_id, target, new_name, new_phone, reason, status, admin_note, requested_by, created_at, reviewed_at, schools(name)",
    )
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as InfoChangeRequestRow[];
  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <>
      <PortalHeader
        title="Contact corrections"
        subtitle="Schools requesting a fix to an educator or principal name / phone — approve to apply it."
      />
      <PortalBody>
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <SectionHeading>
              Pending {pending.length > 0 ? `(${pending.length})` : ""}
            </SectionHeading>
            {!canManage ? <ReadOnlyBadge /> : null}
          </div>
          {pending.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">
              No correction requests awaiting review.
            </p>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <Card key={r.id} className="p-4 space-y-3">
                  <div>
                    <span className="font-medium text-foreground">
                      {r.schools?.name ?? "Unknown school"}
                    </span>
                    <p className="text-sm text-foreground mt-1">
                      {TARGET_LABEL[r.target]}
                      {r.new_name ? ` · Name → ${r.new_name}` : ""}
                      {r.new_phone ? ` · Phone → ${r.new_phone}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Reason: {r.reason}</p>
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <form action={approveInfoChange.bind(null, r.id)}>
                        <ConfirmSubmitButton
                          size="sm"
                          title="Apply this correction?"
                          description={`The ${TARGET_LABEL[r.target].toLowerCase()} details on this registration will be updated${r.new_name ? ` (name → ${r.new_name})` : ""}${r.new_phone ? ` (phone → ${r.new_phone})` : ""}.`}
                          confirmLabel="Yes, apply"
                        >
                          Approve
                        </ConfirmSubmitButton>
                      </form>
                      <form action={declineInfoChange.bind(null, r.id)} className="flex items-center gap-2">
                        <input
                          name="note"
                          placeholder="Reason (optional)"
                          className="rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          destructive
                          title="Decline this correction?"
                          description="Nothing changes on the registration."
                          confirmLabel="Yes, decline"
                        >
                          Decline
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>History</SectionHeading>
          {resolved.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">
              Approved and declined requests appear here.
            </p>
          ) : (
            <Card className="divide-y divide-foreground/5">
              {resolved.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <span className="font-medium text-foreground">
                      {r.schools?.name ?? "Unknown school"}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {TARGET_LABEL[r.target]}
                      {r.new_name ? ` · ${r.new_name}` : ""}
                      {r.new_phone ? ` · ${r.new_phone}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </Card>
          )}
        </div>
      </PortalBody>
    </>
  );
}
