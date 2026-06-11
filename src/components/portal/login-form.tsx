"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/portal";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${location.origin}/portal/auth/callback?redirectTo=${encodeURIComponent(
          redirectTo,
        )}`,
      },
    });

    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="border border-[#E8A020]/40 bg-[rgba(232,160,32,0.08)] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#E8A020] mb-2">
          Check your inbox
        </p>
        <p className="serif-display text-[#4A4E5C] leading-relaxed">
          We sent a sign-in link to{" "}
          <span className="text-[#0A0F1E] font-medium">{email}</span>. Click it
          to continue — you can close this tab.
        </p>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="mt-4 text-xs uppercase tracking-[0.2em] text-[#E8A020] hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="block text-xs font-bold uppercase tracking-[0.2em] text-[#4A4E5C]"
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
          className="w-full rounded-md border border-[#0A0F1E]/15 bg-white px-4 py-3 text-[#0A0F1E] outline-none focus:border-[#E8A020] focus:ring-2 focus:ring-[#E8A020]/20"
        />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={loading || !email}
        className="w-full"
      >
        {loading ? "Sending…" : "Send sign-in link"}
      </Button>
      <p className="text-xs text-[#4A4E5C] text-center">
        We&apos;ll email you a secure link — no password needed.
      </p>
    </form>
  );
}
