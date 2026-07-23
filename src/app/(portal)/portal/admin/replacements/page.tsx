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
import type { StudentReplacementRow } from "@/supabase/types";
import { approveReplacement, declineReplacement } from "./actions";

export const metadata = pageMetadata(
  "Replacements",
  "Student replacement requests from schools.",
);
export const dynamic = "force-dynamic";

export default async function AdminReplacements() {
  await requireModuleView("participants");
  const canManage = await canManageModule("participants");

  const supabase = await createClient();

  // RLS (sr_read) returns all rows to admins.
  const { data } = await supabase
    .from("student_replacements")
    .select(
      "id, registration_id, school_id, rep_slot, old_name, old_level, new_name, new_level, reason, status, created_at, reviewed_at, schools(name)",
    )
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as StudentReplacementRow[];
  const pending = rows.filter((r) => r.status === "pending");
  const resolved = rows.filter((r) => r.status !== "pending");

  return (
    <>
      <PortalHeader
        title="Replacements"
        subtitle="Schools swapping a rep for another student — approve to deactivate the old code and issue a new one."
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
              No replacement requests awaiting review.
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
                      <span className="text-muted-foreground line-through">
                        {r.old_name}
                        {r.old_level ? ` · ${r.old_level}` : ""}
                      </span>
                      {"  →  "}
                      <span className="font-medium">
                        {r.new_name}
                        {r.new_level ? ` · ${r.new_level}` : ""}
                      </span>
                    </p>
                    {r.reason ? (
                      <p className="text-sm text-muted-foreground mt-1">
                        Reason: {r.reason}
                      </p>
                    ) : null}
                  </div>
                  {canManage ? (
                    <div className="flex gap-2">
                      <form action={approveReplacement.bind(null, r.id)}>
                        <ConfirmSubmitButton
                          size="sm"
                          title="Approve this replacement?"
                          description={`${r.old_name}'s access code will stop working and ${r.new_name} gets a new one. The registration and Airtable are updated.`}
                          confirmLabel="Yes, approve"
                        >
                          Approve
                        </ConfirmSubmitButton>
                      </form>
                      <form action={declineReplacement.bind(null, r.id)} className="flex items-center gap-2">
                        <input
                          name="note"
                          placeholder="Reason (optional)"
                          className="rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="outline"
                          destructive
                          title="Decline this replacement?"
                          description={`No student changes. ${r.new_name} will not replace ${r.old_name}.`}
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
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <span className="font-medium text-foreground">
                      {r.schools?.name ?? "Unknown school"}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {r.old_name} → {r.new_name}
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
