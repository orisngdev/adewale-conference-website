"use client";

import { useActionState } from "react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import {
  sendAnnouncement,
  type AnnouncementSendState,
} from "@/app/(portal)/portal/admin/announcements/actions";

export function AnnouncementSendForm({
  announcementId,
  recipientCount,
  channelLabel,
  disabled,
  disabledReason,
}: {
  announcementId: string;
  recipientCount: number;
  channelLabel: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction] = useActionState<AnnouncementSendState, FormData>(
    sendAnnouncement.bind(null, announcementId),
    null,
  );

  const people = `${recipientCount} educator${recipientCount === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col items-start gap-2">
      <form action={formAction}>
        <ConfirmSubmitButton
          size="sm"
          disabled={disabled}
          title={`Send to ${people}?`}
          description={`This goes out via ${channelLabel.toLowerCase()} and cannot be recalled or edited afterwards. Large sends may take up to a minute — don't close the tab.`}
          confirmLabel="Yes, send it"
        >
          Send announcement
        </ConfirmSubmitButton>
      </form>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      {state?.message ? (
        <p
          className={`text-xs ${state.ok ? "text-green-700" : "text-destructive"}`}
          role="status"
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
