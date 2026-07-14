"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Confirmation trigger for forms with MULTIPLE submit buttons that carry a
// name/value (e.g. the bulk approve/decline form). requestSubmit() alone drops
// the button's name/value, so this renders a real hidden submit button with the
// name/value and passes it as the submitter: form.requestSubmit(submitter)
// includes the submitter's name/value in the form data.
//
// Modeled on @/components/ui/confirm-submit-button — same modal markup.
export function ConfirmDecisionButton({
  name,
  value,
  title = "Are you sure?",
  description,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  destructive = false,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  name: string;
  value: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormStatus();
  const submitRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function onConfirm() {
    setOpen(false);
    const submitter = submitRef.current;
    // Submit the enclosing form with the hidden button as the submitter so its
    // name/value is included — runs the bound server action.
    submitter?.form?.requestSubmit(submitter);
  }

  return (
    <>
      {/* Real submit button (hidden) — carries the name/value pair. */}
      <button
        ref={submitRef}
        type="submit"
        name={name}
        value={value}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
      />
      <Button
        {...props}
        type="button"
        disabled={pending || props.disabled}
        onClick={() => setOpen(true)}
      >
        {pending ? "Working…" : children}
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label={title}
            >
              <button
                type="button"
                aria-label="Cancel"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-foreground/50 cursor-default"
              />
              <div className="relative w-full max-w-sm bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.2)] p-6">
                <h2 className="font-bebas text-2xl text-foreground leading-tight">{title}</h2>
                {description ? (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {description}
                  </p>
                ) : null}
                <div className="mt-5 flex justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
                    {cancelLabel}
                  </Button>
                  <Button
                    ref={confirmRef}
                    type="button"
                    size="sm"
                    variant={destructive ? "destructive" : "default"}
                    onClick={onConfirm}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
