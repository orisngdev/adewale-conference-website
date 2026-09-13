"use client";

import { useState } from "react";
import { FELLOWS_APPLICATIONS_OPEN } from "@/lib/fellows-programme";
import FellowsModal from "./fellows-modal";

/**
 * Opens the Fellows application. Every CTA on the Fellows page renders one of
 * these, so the form can only ever be reached one way — which is also why the
 * closed state is decided here rather than at each CTA.
 */
export default function FellowsApplyButton({
  label = "Apply to be a Fellow",
  variant = "solid",
}: {
  label?: string;
  variant?: "solid" | "outline";
}) {
  const [isOpen, setIsOpen] = useState(false);

  const base =
    "inline-block text-xs font-bold tracking-[0.2em] uppercase px-8 py-4 transition-colors";
  const styles =
    variant === "solid"
      ? "bg-[#E8A020] text-foreground hover:bg-[#F5C55A]"
      : "border border-[rgba(250,247,240,0.25)] text-[#F0EAD8] hover:border-[#E8A020] hover:text-primary";

  if (!FELLOWS_APPLICATIONS_OPEN) {
    const closedStyles =
      variant === "solid"
        ? "border border-foreground/20 text-muted-foreground"
        : "border border-[rgba(250,247,240,0.25)] text-[rgba(250,247,240,0.5)]";

    return <span className={`${base} ${closedStyles}`}>Applications closed</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`${base} cursor-pointer ${styles}`}
      >
        {label}
      </button>
      <FellowsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
