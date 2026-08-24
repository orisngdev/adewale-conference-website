"use client";

import { useState } from "react";

// An inline URL with a Copy button. Schools are as often reached on WhatsApp as
// by email, so every emailed link an admin issues needs to be liftable by hand.
export default function CopyLink({ url, label }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — the link stays selectable */
    }
  }

  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded bg-foreground/5 px-2 py-1">
      <span className="truncate font-mono text-[11px] text-muted-foreground" title={url}>
        {label ?? url}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 cursor-pointer text-[10px] font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
