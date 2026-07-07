"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  provisionRep,
  type ProvisionResult,
} from "@/app/(portal)/portal/school/actions";

export default function ProvisionRepButton({
  name,
  level,
  existingCode,
}: {
  name: string;
  level: string | null;
  existingCode?: string;
}) {
  const [state, formAction, pending] = useActionState<
    ProvisionResult | null,
    FormData
  >(provisionRep, null);

  const code = existingCode ?? state?.code;
  if (code) {
    return (
      <span className="font-mono font-bold tracking-wider text-foreground bg-primary/[0.14] px-2.5 py-1 text-sm">
        {code}
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="level" value={level ?? ""} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Generating…" : "Generate login code"}
      </Button>
      {state?.error ? (
        <span className="text-xs text-red-600">{state.error}</span>
      ) : null}
    </form>
  );
}
