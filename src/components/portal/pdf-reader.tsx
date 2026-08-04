"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

// Preview-only PDF viewer. Pages render to <canvas> with the text and annotation
// layers off, so there's no selectable text and no built-in download/print
// affordance — the file is shown, not handed over. The bytes are fetched from a
// same-origin, access-gated route (never a public/S3 link). Screenshots are
// always possible; this stops the easy "save as" path, which is the ask.
//
// The worker is bundled from pdfjs-dist via new URL(import.meta.url) so its
// version always matches the installed pdfjs-dist.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export default function PdfReader({ src, className }: { src: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fit page width to the container (capped for readability on wide screens).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(Math.min(el.clientWidth, 900));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto rounded bg-foreground/5 ${className ?? ""}`}
      // Blunt the right-click "Save image/PDF as…" path on the rendered canvases.
      onContextMenu={(e) => e.preventDefault()}
    >
      {error ? (
        <p className="p-6 text-sm text-muted-foreground">{error}</p>
      ) : (
        <Document
          file={src}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={(e) => setError(e?.message || "Could not load this document.")}
          loading={<p className="p-6 text-sm text-muted-foreground">Loading document…</p>}
          error={<p className="p-6 text-sm text-muted-foreground">Could not load this document.</p>}
          className="flex flex-col items-center gap-3 py-3"
        >
          {width > 0
            ? Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i}
                  pageNumber={i + 1}
                  width={width}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="shadow-[0_2px_16px_-6px_rgba(10,15,30,0.35)]"
                />
              ))
            : null}
        </Document>
      )}
    </div>
  );
}
