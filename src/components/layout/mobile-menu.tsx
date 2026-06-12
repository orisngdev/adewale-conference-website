"use client";

import Link from "next/link";
import type { NavItem } from "@/lib/site";

interface MobileMenuProps {
  open: boolean;
  links: readonly NavItem[];
  cta: NavItem;
  onClose: () => void;
}

export default function MobileMenu({ open, links, cta, onClose }: MobileMenuProps) {
  return (
    <div className="md:hidden" aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 top-18 z-40 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {/* Panel */}
      <div
        className={`fixed top-18 left-0 right-0 z-50 bg-[#0A0F1E] border-b border-[#E8A020] transition-all duration-300 ${
          open
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
      >
        <div className="flex flex-col gap-1 p-4">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium tracking-widest uppercase text-[#F0EAD8] hover:text-[#E8A020] hover:bg-white/5 transition-colors duration-200 px-3 py-3"
              onClick={onClose}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={cta.href}
            className="text-sm font-bold tracking-widest uppercase bg-[#E8A020] text-[#0A0F1E] px-5 py-3 text-center hover:bg-[#F5C55A] transition-colors duration-200 mt-2"
            onClick={onClose}
          >
            {cta.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
