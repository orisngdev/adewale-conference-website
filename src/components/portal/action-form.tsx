"use client";

import { useActionState, type ReactNode } from "react";
import type { ActionResult } from "@/app/(portal)/portal/admin/paper-exams/actions";

// A form whose action reports. Every write in the paper-exam flow returns an
// ActionResult, and this is the one place it gets rendered — so a failed write
// cannot reach the operator as a form that quietly resets.
export default function ActionForm({
  action,
  className,
  children,
  successClassName,
}: {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  className?: string;
  children: ReactNode | ((pending: boolean) => ReactNode);
  successClassName?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null,
  );

  return (
    <div className="space-y-2">
      <form action={formAction} className={className}>
        {typeof children === "function" ? children(pending) : children}
      </form>
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok && state.message ? (
        <p className={successClassName ?? "text-sm text-muted-foreground"}>{state.message}</p>
      ) : null}
    </div>
  );
}
