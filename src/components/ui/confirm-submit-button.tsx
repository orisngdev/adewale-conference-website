"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

// Drop-in replacement for a form's submit button that asks for confirmation
// first. Renders a type="button" trigger; confirming submits the enclosing
// <form> (server action included) via requestSubmit, so native validation
// still runs. Use on every update/delete action so nothing mutates on a
// stray click.
//
//   <form action={deleteThing.bind(null, id)}>
//     <ConfirmSubmitButton
//       title="Delete this resource?"
//       description="Students will lose access immediately."
//       confirmLabel="Yes, delete"
//       size="sm" variant="outline"
//     >
//       Delete
//     </ConfirmSubmitButton>
//   </form>
export function ConfirmSubmitButton({
  title = "Are you sure?",
  description,
  confirmLabel = "Yes, continue",
  cancelLabel = "Cancel",
  destructive = false,
  children,
  ...props
}: ComponentProps<typeof Button> & {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { pending } = useFormStatus();
  const triggerRef = useRef<HTMLButtonElement>(null);
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
    // Submit the enclosing form — runs the bound server action.
    triggerRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <Button
        {...props}
        ref={triggerRef}
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
