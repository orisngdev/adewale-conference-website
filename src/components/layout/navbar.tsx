"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileMenu from "./mobile-menu";
import { MAIN_NAV, NAV_CTA } from "@/lib/site";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the menu is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-6 md:px-12 h-18 bg-[#0A0F1E] border-b-2 border-[#E8A020]">
        <Link
          href="/"
          className="font-bebas text-xl md:text-2xl text-white tracking-widest"
        >
          ASC <span className="text-primary">2026</span>
        </Link>

        <ul className="hidden md:flex items-center gap-9 list-none">
          {MAIN_NAV.map((link) => {
            const active = pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`text-xs md:text-sm font-medium tracking-widest uppercase transition-colors duration-200 ${
                    active
                      ? "text-primary"
                      : "text-[#F0EAD8] hover:text-primary"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href={NAV_CTA.href}
              className="text-xs md:text-sm font-bold tracking-widest uppercase bg-[#E8A020] text-foreground px-5 py-2 hover:bg-[#F5C55A] transition-colors duration-200"
            >
              {NAV_CTA.label}
            </Link>
          </li>
        </ul>

        <button
          className="md:hidden relative w-6 h-6 z-110"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          <span
            className={`absolute left-0 top-1/2 w-6 h-0.5 bg-white transition-transform duration-300 ${
              open ? "rotate-45" : "-translate-y-1.5"
            }`}
          />
          <span
            className={`absolute left-0 top-1/2 w-6 h-0.5 bg-white transition-opacity duration-200 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 top-1/2 w-6 h-0.5 bg-white transition-transform duration-300 ${
              open ? "-rotate-45" : "translate-y-1.5"
            }`}
          />
        </button>
      </nav>

      <MobileMenu
        open={open}
        links={MAIN_NAV}
        cta={NAV_CTA}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
