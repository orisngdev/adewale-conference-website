"use client";

import { useEffect, useState } from "react";

// A sticky, collapsible code editor docked to the bottom of the viewport so
// students can build alongside a lesson without scrolling away from it. The
// iframe stays mounted while minimised, so typed code survives open/close.
export default function CodeDrawer({ src, title = "Editor" }: { src: string; title?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Floating toggle — sits above the mobile bottom nav. Hidden while open. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="fixed right-4 bottom-20 md:bottom-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-primary-foreground shadow-[0_8px_24px_-6px_rgba(232,160,32,0.6)] hover:bg-primary/90"
        >
          <span aria-hidden className="font-mono text-sm">&lt;/&gt;</span>
          <span className="text-sm font-bold uppercase tracking-wide">Code</span>
        </button>
      ) : null}

      {/* Docked drawer. Always rendered (iframe stays alive); slid off-screen when closed. */}
      <div
        aria-hidden={!open}
        className={`fixed inset-x-0 bottom-0 z-50 transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
      >
        <div className="mx-auto max-w-5xl bg-card border-t border-x border-foreground/10 shadow-[0_-12px_44px_-12px_rgba(10,15,30,0.4)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <span aria-hidden className="font-mono">&lt;/&gt;</span> {title}
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground hover:text-foreground"
              aria-label="Minimise editor"
            >
              Minimise ▾
            </button>
          </div>
          <iframe
            src={src}
            title={title}
            className="w-full h-[60vh] md:h-[460px] bg-card"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </div>
      </div>
    </>
  );
}
