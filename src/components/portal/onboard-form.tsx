"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/portal/submit-button";
import { completeOnboarding, type OnboardState } from "@/app/(portal)/portal/onboard/actions";

// Password form for the emailed activation link. On success the account was just
// created server-side with this password, so we sign straight in and land the
// coordinator on their school dashboard — codes and all.
export default function OnboardForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<OnboardState, FormData>(completeOnboarding, null);
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    if (!state?.ok || state.mode !== "created" || signedIn.current) return;
    signedIn.current = true;
    setSigningIn(true);
    const supabase = createClient();
    supabase.auth
      .signInWithPassword({ email: state.email, password })
      .then(({ error }) => {
        if (error) {
          // Account exists with the password they just set — worst case they log
          // in manually.
          router.push("/portal/login?redirectTo=%2Fportal%2Fschool");
        } else {
          router.push("/portal/school");
        }
        router.refresh();
      });
  }, [state, password, router]);

  if (state?.ok && state.mode === "existing") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          <span className="font-bold text-green-700">Your school is linked.</span>{" "}
          <span className="font-medium">{state.email}</span> already had a portal
          account, so your existing password still applies — sign in to see your
          school and your students&apos; access codes.
        </p>
        <Link
          href="/portal/login?redirectTo=%2Fportal%2Fschool"
          className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="block text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
          Your email
        </label>
        <Input value={email} disabled aria-label="Coordinator email" />
      </div>
      <div>
        <label
          htmlFor="onboard-password"
          className="block text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5"
        >
          Choose a password
        </label>
        <Input
          id="onboard-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label
          htmlFor="onboard-confirm"
          className="block text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1.5"
        >
          Confirm password
        </label>
        <Input
          id="onboard-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
        />
      </div>
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <SubmitButton className="w-full" pendingText="Activating…">
        {signingIn ? "Signing you in…" : "Activate & sign in"}
      </SubmitButton>
    </form>
  );
}
