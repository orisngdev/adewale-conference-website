"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";

type Mode = "password" | "signup" | "magic";

const inputCls =
  "w-full rounded-md border border-foreground/15 bg-card px-4 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export default function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const redirectTo = params.get("redirectTo") || "/portal";

  const [supabase] = useState(() => createClient());
  // Arriving from a claim link → likely a new coordinator: default to sign-up so
  // they set a password first, then get returned to /portal/claim.
  const [mode, setMode] = useState<Mode>(
    redirectTo.includes("/portal/claim") ? "signup" : "password",
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

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: callbackUrl(redirectTo) },
      });
      setLoading(false);
      if (error) setMsg({ type: "error", text: error.message });
      else if (data.session) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setMsg({
          type: "info",
          text: "Check your email to confirm your account, then sign in.",
        });
      }
      return;
    }

    // magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl(redirectTo) },
    });
    setLoading(false);
    if (error) setMsg({ type: "error", text: error.message });
    else setMsg({ type: "info", text: `We sent a sign-in link to ${email}.` });
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
    mode === "signup"
      ? loading
        ? "Creating…"
        : "Create account"
      : mode === "magic"
        ? loading
          ? "Sending…"
          : "Send sign-in link"
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

      {mode !== "magic" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Password
            </label>
            {mode === "password" ? (
              <button
                type="button"
                onClick={onForgot}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
            ) : null}
          </div>
          <input
            id="password"
            type="password"
            required
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "signup" ? "Choose a password" : "Your password"}
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
            New here?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setMsg(null);
              }}
              className="text-primary hover:underline font-medium"
            >
              Create an account
            </button>
          </p>
        ) : (
          <p>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => {
                setMode("password");
                setMsg(null);
              }}
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </button>
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "magic" ? "password" : "magic");
            setMsg(null);
          }}
          className="text-primary hover:underline"
        >
          {mode === "magic"
            ? "Use a password instead"
            : "Email me a sign-in link instead"}
        </button>
      </div>
    </form>
  );
}
