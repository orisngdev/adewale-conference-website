"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

// Tab bar for settings-style pages. Panels are server-rendered and passed in as
// ReactNodes; all stay mounted (hidden) so form state survives tab switches.
//
// Pass `paramKey` to keep the active tab in the URL. Without it the tab lives in
// client state, and anything that navigates — a GET form, a redirect after a
// server action, a reload — silently drops the reader back on the first tab.
export default function SettingsTabs({
  tabs,
  paramKey,
}: {
  tabs: {
    label: string;
    slug?: string;
    /** Optional pipeline state. When set, the tab shows a tick or its step
     *  number — so the tab bar IS the progress indicator, rather than needing a
     *  second row of navigation saying the same thing in different words. */
    status?: "done" | "todo";
    content: ReactNode;
  }[];
  paramKey?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const slugs = tabs.map((t, i) => t.slug ?? String(i));

  const fromUrl = paramKey ? slugs.indexOf(params.get(paramKey) ?? "") : -1;
  const [local, setLocal] = useState(0);
  const active = paramKey ? (fromUrl >= 0 ? fromUrl : 0) : local;

  const select = (i: number) => {
    if (!paramKey) {
      setLocal(i);
      return;
    }
    const next = new URLSearchParams(params.toString());
    next.set(paramKey, slugs[i]);
    // replace, not push: flipping tabs is not a step worth a Back press.
    router.replace(`?${next.toString()}`, { scroll: false });
  };

  return (
    <div>
      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-foreground/10">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => select(i)}
            className={`flex cursor-pointer items-center gap-2 py-3 text-sm tracking-wide border-b-2 -mb-px whitespace-nowrap transition-colors ${
              i === active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.status ? (
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${
                  t.status === "done"
                    ? "bg-primary/15 text-primary"
                    : i === active
                      ? "bg-primary text-primary-foreground"
                      : "bg-foreground/10 text-muted-foreground"
                }`}
                aria-hidden
              >
                {t.status === "done" ? "✓" : i + 1}
              </span>
            ) : null}
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} role="tabpanel" hidden={i !== active} className="pt-6">
          {t.content}
        </div>
      ))}
    </div>
  );
}
