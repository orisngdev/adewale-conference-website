"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/portal/submit-button";
import { updateTeamMemberPermissions } from "@/app/(portal)/portal/admin/actions";
import type { AdminPermissionsMap, AdminRolePreset } from "@/supabase/types";
import { TeamPermissionFields } from "./permission-fields";

// "Edit permissions" for one active admin. Opens a modal (portal-rendered, same
// pattern as ConfirmSubmitButton) holding the shared preset/matrix control bound
// to the updateTeamMemberPermissions server action. The action runs through
// useActionState so the modal closes only once the save actually completes (the
// server revalidates the settings page with the new summary).
export function EditPermissionsDialog({
  profileId,
  memberName,
  preset,
  permissions,
}: {
  profileId: string;
  memberName: string;
  preset: AdminRolePreset;
  permissions: AdminPermissionsMap;
}) {
  const [open, setOpen] = useState(false);
  const [saveCount, save] = useActionState(async (count: number, formData: FormData) => {
    await updateTeamMemberPermissions(profileId, formData);
    return count + 1;
  }, 0);

  // Close after a completed save (saveCount changes only when the action returns).
  useEffect(() => {
    if (saveCount > 0) setOpen(false);
  }, [saveCount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit permissions
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Edit permissions for ${memberName}`}
            >
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-foreground/50 cursor-default"
              />
              <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.2)] p-6">
                <h2 className="font-bebas text-2xl text-foreground leading-tight">
                  {memberName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Choose a preset or set each section to None, Read-only, or Manage.
                </p>
                <form action={save}>
                  <TeamPermissionFields
                    defaultPreset={preset}
                    defaultPermissions={permissions}
                  />
                  <div className="mt-5 flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <SubmitButton size="sm" pendingText="Saving…">
                      Save permissions
                    </SubmitButton>
                  </div>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
