"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import PdfReader from "@/components/portal/pdf-reader";

// "Preview" affordance for a resource that isn't downloadable. PDFs open in an
// in-app, preview-only reader (canvas, no download). Other document types can't
// render to canvas, so they open inline in a new browser tab instead.
export default function ResourcePreviewButton({
  id,
  title,
  isPdf,
}: {
  id: string;
  title: string;
  isPdf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const src = `/api/resources/${id}/view`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const triggerCls =
    "mt-3 inline-flex items-center gap-1 text-xs uppercase tracking-[0.15em] text-primary hover:underline";

  if (!isPdf) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer" className={triggerCls}>
        Preview ↗
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerCls}>
        Preview ↗
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={`Preview ${title}`}
            >
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-foreground/60 cursor-default"
              />
              <div className="relative flex h-[90vh] w-full max-w-4xl flex-col bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.3)]">
                <div className="flex items-center justify-between gap-3 border-b border-foreground/10 px-4 py-3">
                  <p className="font-bebas text-lg text-foreground truncate">{title}</p>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="text-sm text-muted-foreground hover:text-foreground"
                    aria-label="Close"
                  >
                    Close ✕
                  </button>
                </div>
                <PdfReader src={src} className="flex-1" />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
