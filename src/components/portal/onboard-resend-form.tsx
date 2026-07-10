"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/portal/submit-button";
import {
  requestActivationResend,
  type ResendState,
} from "@/app/(portal)/portal/onboard/actions";

// "Lost your activation link?" — resends to the email on file. The response is
// deliberately the same whether or not the email matched (no enumeration).
export default function OnboardResendForm() {
  const [state, formAction] = useActionState<ResendState, FormData>(
    requestActivationResend,
    null,
  );

  if (state?.done) {
    return (
      <p className="text-sm text-foreground">
        <span className="font-bold text-green-700">Check your inbox.</span> If that
        email has a pending registration, a fresh activation link (valid 30 days)
        is on its way.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <label
        htmlFor="resend-email"
        className="block text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground"
      >
        Email you registered with
      </label>
      <div className="flex gap-2">
        <Input
          id="resend-email"
          name="email"
          type="email"
          required
          placeholder="teacher@school.edu"
          className="flex-1"
        />
        <SubmitButton size="sm" pendingText="Sending…">
          Resend link
        </SubmitButton>
      </div>
      {state && !state.done ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
