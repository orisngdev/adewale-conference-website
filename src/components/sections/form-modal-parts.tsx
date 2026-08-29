"use client";

import { Button } from "../ui/button";

/**
 * The shared chrome behind the site's dark form modals — school registration and
 * the Adéwálé Fellows application.
 *
 * Extracted so the two modals cannot drift into looking like different products.
 * Everything here is presentational: the field styling, the section rule, and the
 * full-panel result dialog that replaced toasts so an outcome cannot be missed.
 */

export const inputClass =
  "w-full bg-white/5 border border-white/10 px-4 py-3 text-white placeholder-white/30 outline-none focus:border-[#E8A020] transition-colors text-sm";

export const selectClass =
  "w-full bg-white/5 border border-white/10 px-4 py-3 text-white outline-none focus:border-[#E8A020] transition-colors cursor-pointer appearance-none text-sm disabled:cursor-not-allowed disabled:opacity-70";

export const labelClass =
  "block text-[10px] font-bold tracking-widest uppercase text-white/40 mb-2";

export interface SubmitResult {
  kind: "success" | "warning" | "error";
  title: string;
  message: string;
}

export const RESULT_STYLES: Record<
  SubmitResult["kind"],
  { ring: string; icon: string; path: string }
> = {
  success: {
    ring: "border-[#1A7A4A]/50 bg-[#1A7A4A]/15 text-[#4ADE80]",
    icon: "text-[#4ADE80]",
    path: "M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  warning: {
    ring: "border-[#E8A020]/50 bg-[#E8A020]/15 text-[#E8A020]",
    icon: "text-[#E8A020]",
    path: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z",
  },
  error: {
    ring: "border-red-500/50 bg-red-500/15 text-red-300",
    icon: "text-red-400",
    path: "M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
};

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  /** Marks the label with an asterisk. Opt-in: a form where everything is
   *  required gains nothing from asterisks on every line. */
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>
        {label}
        {required ? (
          <span className="ml-1 text-red-400" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="mt-2 text-[11px] leading-relaxed text-white/35">{hint}</p> : null}
    </div>
  );
}

export function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-5 mt-2">
      <span className="block w-6 h-px bg-[#E8A020]" />
      <span className="font-bebas text-lg md:text-xl tracking-widest text-primary">
        {title}
      </span>
    </div>
  );
}

// Full-panel result dialog — replaces the old toasts so the outcome can't be
// missed (success, duplicate-school warning, or error).
export function ResultDialog({
  result,
  onDismiss,
  labelledById,
  dismissLabel,
}: {
  result: SubmitResult;
  onDismiss: () => void;
  labelledById: string;
  dismissLabel?: string;
}) {
  const style = RESULT_STYLES[result.kind];
  return (
    <div
      className="absolute inset-0 z-10 flex items-center justify-center bg-[#0A0F1E]/95 p-6"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={labelledById}
    >
      <div className="w-full max-w-md text-center">
        <div
          className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border ${style.ring}`}
        >
          <svg
            className={`h-8 w-8 ${style.icon}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={style.path} />
          </svg>
        </div>
        <h4
          id={labelledById}
          className="font-bebas text-2xl md:text-3xl text-white tracking-tight"
        >
          {result.title}
        </h4>
        <p className="mt-3 text-sm leading-relaxed text-white/60">{result.message}</p>
        <Button
          type="button"
          onClick={onDismiss}
          className="mt-8 w-full rounded-none bg-[#E8A020] py-5 text-xs font-bold uppercase tracking-[0.2em] text-foreground hover:bg-white"
        >
          {dismissLabel ?? (result.kind === "success" ? "Done" : "Back to form")}
        </Button>
      </div>
    </div>
  );
}
