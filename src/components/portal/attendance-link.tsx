"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** The link the exam desk sends to centre staff. Centre leads have no portal
 *  account and no bookmark, so this is how the URL reaches their phones. */
export default function AttendanceLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard is blocked outside a secure context; the text is selectable.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="flex-1 truncate bg-foreground/5 px-2 py-1.5 text-xs">{url}</code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-foreground/20 px-3 text-xs font-bold"
      >
        {copied ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
