"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signIn, type SignInResult } from "@/app/(centre)/attendance/actions";
import type { ExamCentre } from "@/supabase/types";

const fieldClass =
  "w-full rounded-md border border-foreground/15 bg-card px-3 py-3 text-base outline-none" +
  " focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-[3px]";

export default function SignInForm({ centres }: { centres: ExamCentre[] }) {
  const [state, formAction, pending] = useActionState<SignInResult | null, FormData>(signIn, null);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Your centre
        </span>
        <select name="centre_id" required defaultValue="" className={`${fieldClass} mt-1`}>
          <option value="" disabled>
            Choose your centre…
          </option>
          {centres.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}, {c.town}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Your email
        </span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          className={`${fieldClass} mt-1`}
        />
      </label>

      {state && !state.ok ? (
        <p role="alert" className="border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary px-4 text-base font-bold text-primary-foreground disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
