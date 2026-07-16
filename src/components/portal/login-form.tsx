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
  // Once the email is sent, we also accept the 6-digit code from that email.
  // Link-scanners (Outlook SafeLinks, corporate filters) pre-fetch the sign-in
  // link and burn its single-use token; typing the code sidesteps that.
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "error" | "info"; text: string } | null>(
    null,
  );

  const callbackUrl = (to: string) =>
    `${location.origin}/portal/auth/callback?redirectTo=${encodeURIComponent(to)}`;

  // Both the emailed link and the typed code land new users on the set-password
  // page (harmless for returning users, who can keep their existing password).
  const WELCOME = "/portal/reset?welcome=1";

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

    // Second magic-mode step: verify the 6-digit code the user typed from the
    // email. Succeeds even if the clickable link was already consumed/expired.
    if (codeSent) {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      setLoading(false);
      if (error) setMsg({ type: "error", text: error.message });
      else {
        router.push(WELCOME);
        router.refresh();
      }
      return;
    }

    // First magic-mode step: send the email (contains both a link and a code).
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(WELCOME) },
    });
    setLoading(false);
    if (error) setMsg({ type: "error", text: error.message });
    else {
      setCodeSent(true);
      setMsg({
        type: "info",
        text: `We sent a sign-in link and a 6-digit code to ${email}. Click the link, or enter the code below.`,
      });
    }
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
      ? codeSent
        ? loading
          ? "Verifying…"
          : "Verify code & continue"
        : loading
          ? "Sending…"
          : "Email me a sign-in link"
      : loading
        ? "Signing in…"
        : "Sign in";

  function backToEmail() {
    setCodeSent(false);
    setCode("");
    setMsg(null);
  }

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
          readOnly={codeSent}
          placeholder="you@school.edu.ng"
          className={`${inputCls}${codeSent ? " opacity-70" : ""}`}
        />
      </div>

      {mode === "magic" && codeSent ? (
        <div className="space-y-2">
          <label
            htmlFor="code"
            className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
          >
            6-digit code from the email
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className={`${inputCls} tracking-[0.4em] font-mono`}
          />
          <button
            type="button"
            onClick={backToEmail}
            className="text-xs text-primary hover:underline"
          >
            Use a different email
          </button>
        </div>
      ) : null}

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

      <Button
        type="submit"
        size="lg"
        disabled={loading || !email || (mode === "magic" && codeSent && code.length < 6)}
        className="w-full"
      >
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
                backToEmail();
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
                backToEmail();
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
