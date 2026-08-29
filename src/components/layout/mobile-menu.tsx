"use client";

import Link from "next/link";
import { isNavGroup, type NavEntry, type NavItem } from "@/lib/site";

interface MobileMenuProps {
  open: boolean;
  entries: readonly NavEntry[];
  cta: NavItem;
  onClose: () => void;
}

const linkCls =
  "block text-sm font-medium tracking-widest uppercase text-[#F0EAD8] hover:text-primary hover:bg-white/5 transition-colors duration-200 px-3 py-3";

export default function MobileMenu({
  open,
  entries,
  cta,
  onClose,
}: MobileMenuProps) {
  return (
    <div className="lg:hidden" aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 top-18 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Panel */}
      <div
        className={`fixed top-18 left-0 right-0 z-50 max-h-[calc(100vh-4.5rem)] overflow-y-auto bg-[#0A0F1E] border-b border-[#E8A020] transition-all duration-300 ${
          open
            ? "opacity-100 translate-y-0"
            : "invisible opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-1 p-4">
          {/* Groups become labelled sections rather than accordions — everything
              stays one tap away on the screen where taps cost the most. */}
          {entries.map((entry) =>
            isNavGroup(entry) ? (
              <div key={entry.label} className="mt-2 first:mt-0">
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.25em] uppercase text-primary/70">
                  {entry.label}
                </div>
                {entry.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={linkCls}
                    onClick={onClose}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                className={`${linkCls} mt-2 first:mt-0`}
                onClick={onClose}
              >
                {entry.label}
              </Link>
            ),
          )}
          <Link
            href="/portal"
            className="text-sm font-bold tracking-widest uppercase border border-[#E8A020] text-primary px-5 py-3 text-center hover:bg-[#E8A020] hover:text-foreground transition-colors duration-200 mt-4"
            onClick={onClose}
          >
            Portal
          </Link>
          <Link
            href={cta.href}
            className="text-sm font-bold tracking-widest uppercase bg-[#E8A020] text-foreground px-5 py-3 text-center hover:bg-[#F5C55A] transition-colors duration-200 mt-2"
            onClick={onClose}
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
