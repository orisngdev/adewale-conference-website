"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

// The public site is light-only (cream/navy) and uses a custom ThemeContext, not
// next-themes — so force light + richColors for readable success/error toasts.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      richColors
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
