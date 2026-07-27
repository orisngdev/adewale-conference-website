"use client";

import { useActionState } from "react";
import { Mail, UserRound } from "lucide-react";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Card } from "@/components/portal/ui";
import {
  updateRegistrationContact,
  type ContactUpdateState,
} from "@/app/(portal)/portal/admin/actions";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export function RegistrationContactEditor({
  registrationId,
  kind,
  label,
  name,
  email,
  status,
  canManage,
}: {
  registrationId: string;
  kind: "teacher" | "principal";
  label: string;
  name: string;
  email: string;
  status: string;
  canManage: boolean;
}) {
  const [state, formAction] = useActionState<ContactUpdateState, FormData>(
    updateRegistrationContact.bind(null, registrationId),
    null,
  );

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UserRound className="size-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {label}
          </p>
          <p className="font-medium text-foreground truncate">{name || "Name not captured"}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{status}</p>
        </div>
      </div>

      {canManage ? (
        <form action={formAction} className="space-y-2">
          <input type="hidden" name="contact_kind" value={kind} />
          <label className="block space-y-1">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Email address
            </span>
            <input
              name="email"
              type="email"
              required
              defaultValue={email}
              placeholder={`${kind}@school.edu`}
              className={`${inputCls} w-full`}
            />
          </label>
          {state ? (
            <p
              className={`text-sm ${state.ok ? "text-green-700" : "text-red-600"}`}
              role={state.ok ? "status" : "alert"}
            >
              {state.message}
            </p>
          ) : null}
          <ConfirmSubmitButton
            size="sm"
            variant="outline"
            title={`Update ${label.toLowerCase()} email?`}
            description="Access moves to this address. If it does not have a portal account yet, a fresh activation link is emailed."
            confirmLabel="Yes, update"
          >
            <Mail className="size-4" />
            Save email
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </Card>
  );
}
