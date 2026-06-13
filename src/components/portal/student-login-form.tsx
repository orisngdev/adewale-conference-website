"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { studentLogin } from "@/app/(portal)/portal/student-login/actions";

export default function StudentLoginForm() {
  const [error, formAction, pending] = useActionState(studentLogin, null);

  return (
    <form action={formAction} className="space-y-4">
      <input
        name="code"
        required
        placeholder="Enter your access code"
        className="w-full rounded-md border border-[#0A0F1E]/15 bg-white px-4 py-3 text-[#0A0F1E] uppercase tracking-widest outline-none focus:border-[#E8A020] focus:ring-2 focus:ring-[#E8A020]/20"
      />
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
