"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/portal/ui";

// Redeem a team login code to merge a self-signup account with the
// Coordinator-provisioned Rep record (ADR 0001) so progress lives in one place.
export default function LinkAccountForm() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const s = createClient();
    const { data, error } = await s.rpc("link_student_account", { p_code: code.trim() });
    setBusy(false);
    if (error) return setMsg("Something went wrong — try again.");
    const d = data as { ok?: boolean; error?: string };
    if (d?.error === "not_found") setMsg("No team account matches that code.");
    else if (d?.ok) setMsg("Linked! Your team progress now shows on this account.");
  }

  return (
    <Card className="p-5 space-y-2">
      <p className="text-sm text-muted-foreground">
        Have a team login code from your teacher? Link it to merge your practice and exam progress.
      </p>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Team code"
          className="flex-1"
        />
        <Button type="submit" size="sm" disabled={busy || !code.trim()}>
          {busy ? "Linking…" : "Link"}
        </Button>
      </form>
      {msg ? <p className="text-sm text-foreground">{msg}</p> : null}
    </Card>
  );
}
