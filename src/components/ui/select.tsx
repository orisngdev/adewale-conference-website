import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

/**
 * The shared dropdown. A styled *native* `<select>` — deliberately not a Radix
 * or headless popup, because most of the portal's selects live in server
 * components inside `<form action={serverAction}>` and are read back off
 * FormData. A JS popup would force those pages to become client components.
 *
 * It renders exactly one element and nothing else. Call sites pass layout
 * classes (`w-full`, `flex-1`, `mt-1`, `capitalize`, grid spans) straight onto
 * it, so a wrapping `<div>` for the chevron would silently break them — hence
 * the chevron is painted as a background image by the `select-chevron`
 * utilities in globals.css.
 */
const selectVariants = cva(
  // Base mirrors ui/input.tsx so a select and a text field read as one control.
  // The pr-* in each size leaves room for the chevron.
  // No w-full here: unlike Input, most selects are intrinsically sized (filter
  // bars, inline table editors). Call sites that want it already pass it.
  "appearance-none bg-no-repeat text-foreground shadow-xs outline-none transition-colors " +
    "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] " +
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20 " +
    "disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "select-chevron rounded-md border border-input bg-card",
        /**
         * The public dark form modals — square, white-on-navy. The `[&_option]`
         * rule is what stops the OS dropdown rendering white-on-white; it
         * replaces a `className` on every single `<option>`.
         */
        onDark:
          "select-chevron-on-dark w-full cursor-pointer border border-white/10 bg-white/5 text-white " +
          "focus-visible:border-primary focus-visible:ring-0 disabled:opacity-70 " +
          "[&_option]:bg-foreground [&_option]:text-white",
      },
      size: {
        default: "h-9 py-1 pl-3 pr-9 text-sm",
        /** Dense inline editors and table rows. */
        sm: "py-1 pl-2 pr-7 text-xs",
        /** Public modals — clears a 44px tap target. */
        lg: "py-3 pl-4 pr-10 text-sm",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

function Select({
  className,
  variant,
  size,
  ...props
}: // `size` is omitted because a <select> already has a native numeric `size`
// attribute (which renders it as an open list box). Nothing here uses that, and
// leaving it in place collides with the variant and resolves to `never`.
Omit<React.ComponentProps<"select">, "size"> & VariantProps<typeof selectVariants>) {
  return (
    <select
      data-slot="select"
      className={cn(selectVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Select, selectVariants };
