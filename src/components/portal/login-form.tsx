"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";

// No public sign-up: accounts come from registration + the Airtable sync, which
// stage each educator as an approved school member. First-timers sign in with a
// one-time email link, then set a password (they land on /portal/reset).
type Mode = "password" | "magic";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const redirectTo = params.get("redirectTo") || "/portal";

  const [supabase] = useState(() => createClient());
  // Claim links are hit by brand-new coordinators — default them to the email
  // link so their account is created and they're guided to set a password.
  const [mode, setMode] = useState<Mode>(
    redirectTo.includes("/portal/claim") ? "magic" : "password",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "info"; text: string } | null>(
    null,
  );

  const callbackUrl = (to: string) =>
    `${location.origin}/portal/auth/callback?redirectTo=${encodeURIComponent(to)}`;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setMsg({ type: "error", text: error.message });
      else {
        router.push(redirectTo);
        router.refresh();
      }
      return;
    }

    // Magic link → after sign-in, land on the set-password page so new users
    // finish with a password of their own (valid for returning users too).
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl("/portal/reset?welcome=1") },
    });
    setLoading(false);
    if (error) setMsg({ type: "error", text: error.message });
    else
      setMsg({
        type: "info",
        text: `We sent a sign-in link to ${email}. Open it to continue and set your password.`,
      });
  }

  async function onForgot() {
    if (!email) {
      setMsg({ type: "error", text: "Enter your email first." });
      return;
    }
    setLoading(true);
    setMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: callbackUrl("/portal/reset"),
    });
    setLoading(false);
    if (error) setMsg({ type: "error", text: error.message });
    else
      setMsg({ type: "info", text: `We sent a password reset link to ${email}.` });
  }

  const submitLabel =
    mode === "magic"
      ? loading
        ? "Sending…"
        : "Email me a sign-in link"
      : loading
        ? "Signing in…"
        : "Sign in";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@school.edu.ng"
          className={inputCls}
        />
      </div>

      {mode === "password" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Password
            </label>
            <button
              type="button"
              onClick={onForgot}
              className="text-xs text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={inputCls}
          />
        </div>
      ) : null}

      {msg ? (
        <p
          className={`text-sm ${msg.type === "error" ? "text-red-600" : "text-muted-foreground"}`}
          role={msg.type === "error" ? "alert" : undefined}
        >
          {msg.text}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={loading || !email} className="w-full">
        {submitLabel}
      </Button>

      <div className="text-sm text-muted-foreground space-y-2 pt-1">
        {mode === "password" ? (
          <p>
            First time here, or no password yet?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("magic");
                setMsg(null);
              }}
              className="text-primary hover:underline font-medium"
            >
              Email me a sign-in link
            </button>
          </p>
        ) : (
          <p>
            Already set a password?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setMsg(null);
              }}
              className="text-primary hover:underline font-medium"
            >
              Sign in with it
            </button>
          </p>
        )}
      </div>
    </form>
  );
}
