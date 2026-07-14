"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/portal/submit-button";
import {
  completeTeamInvite,
  type TeamInviteState,
} from "@/app/(portal)/portal/team-invite/actions";

// Password form for the emailed team-invite link. On success the admin account
// was just created server-side with this password, so we sign straight in and
// land them on the admin console.
export default function TeamInviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter();
  const [state, formAction] = useActionState<TeamInviteState, FormData>(
    completeTeamInvite,
    null,
  );
  const [password, setPassword] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const signedIn = useRef(false);

  useEffect(() => {
    if (!state?.ok || signedIn.current) return;
    signedIn.current = true;
    setSigningIn(true);
    const supabase = createClient();
    supabase.auth
      .signInWithPassword({ email: state.email, password })
      .then(({ error }) => {
        if (error) {
          // Account exists with the password they just set — worst case they log
          // in manually.
          router.push("/portal/login");
        } else {
          router.push("/portal/admin");
        }
        router.refresh();
      });
  }, [state, password, router]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Email
        </label>
        <Input value={email} disabled className="opacity-70" />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Choose a password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="confirm"
          className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Confirm password
        </label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repeat the password"
        />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {signingIn ? (
        <p className="text-sm text-muted-foreground">Account ready — signing you in…</p>
      ) : null}

      <SubmitButton size="lg" className="w-full" pendingText="Setting up your account…">
        Activate admin account
      </SubmitButton>
    </form>
  );
}
