"use client";

import { useActionState } from "react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  sendRegistrationStatusAnnouncement,
  type RegistrationAnnouncementState,
} from "@/app/(portal)/portal/admin/editions/actions";

export function RegistrationAnnouncementForm({
  year,
  registrationOpen,
}: {
  year: number;
  registrationOpen: boolean;
}) {
  const [state, formAction] = useActionState<RegistrationAnnouncementState, FormData>(
    sendRegistrationStatusAnnouncement.bind(null, year),
    null,
  );
  const statusLabel = registrationOpen ? "open" : "closed";

  return (
    <div className="flex flex-col items-start gap-1">
      <form action={formAction}>
        <ConfirmSubmitButton
          size="sm"
          variant="outline"
          title={`Announce registration is ${statusLabel}?`}
          description={`This sends educators an email and creates portal notifications saying ${year} registration is ${statusLabel}. Duplicate announcements for this same status are blocked for 24 hours.`}
          confirmLabel="Yes, announce"
        >
          Send status update
        </ConfirmSubmitButton>
      </form>
      {state?.message ? (
        <p
          className={`text-xs ${
            state.ok ? "text-green-700" : "text-destructive"
          }`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
