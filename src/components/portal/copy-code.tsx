"use client";

import { useState } from "react";

// A fenced code block with a Copy button, so students can lift a step's code
// straight into the editor instead of retyping it.
export default function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — leave the code for manual selection */
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute right-2 top-2 z-10 rounded bg-foreground/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground hover:bg-foreground/15 hover:text-foreground"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-md bg-foreground/5 p-3 pr-16 text-xs leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
    </div>
  );
}
