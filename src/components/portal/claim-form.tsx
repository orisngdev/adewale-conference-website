"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { claimRegistration } from "@/app/(portal)/portal/school/actions";

export default function ClaimForm({ defaultCode }: { defaultCode?: string }) {
  const [error, formAction, pending] = useActionState(claimRegistration, null);

  return (
    <form action={formAction} className="flex flex-col sm:flex-row gap-2">
      <input
        name="code"
        required
        defaultValue={defaultCode}
        placeholder="Enter your claim code"
        className="flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm uppercase tracking-wide outline-none focus:border-primary"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Claiming…" : "Claim school"}
      </Button>
      {error ? (
        <p className="text-sm text-red-600 sm:self-center">{error}</p>
      ) : null}
    </form>
  );
}
