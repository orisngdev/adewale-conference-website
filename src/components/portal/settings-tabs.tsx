"use client";

import { useState, type ReactNode } from "react";

// Tab bar for settings-style pages. Panels are server-rendered and passed in as
// ReactNodes; all stay mounted (hidden) so form state survives tab switches.
export default function SettingsTabs({
  tabs,
}: {
  tabs: { label: string; content: ReactNode }[];
}) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-foreground/10">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`cursor-pointer py-3 text-sm tracking-wide border-b-2 -mb-px whitespace-nowrap transition-colors ${
              i === active
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
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
