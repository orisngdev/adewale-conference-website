"use client";

import { useRef, type FocusEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { isNavItemActive, type NavGroup } from "@/lib/site";

interface NavDropdownProps {
  group: NavGroup;
  /** Open state is owned by the navbar so only one group can be open at a time. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
}

/**
 * One desktop nav group: a trigger plus the panel of links beneath it.
 *
 * Opens on hover for pointer users and on click/Enter for everyone else. The
 * panel is hidden with `invisible` rather than unmounted, which keeps its links
 * out of the tab order and the accessibility tree while still allowing the fade
 * to animate.
 */
export default function NavDropdown({
  group,
  open,
  onOpenChange,
  pathname,
}: NavDropdownProps) {
  const containerRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const active = group.items.some((item) => isNavItemActive(item.href, pathname));

  // Close only when focus leaves the group entirely — moving between the trigger
  // and its own links must not dismiss the panel mid-keyboard-navigation.
  function handleBlur(event: FocusEvent<HTMLLIElement>) {
    if (!containerRef.current?.contains(event.relatedTarget)) {
      onOpenChange(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLLIElement>) {
    if (event.key === "Escape" && open) {
      onOpenChange(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <li
      ref={containerRef}
      className="relative"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => onOpenChange(!open)}
        className={`flex cursor-pointer items-center gap-1.5 text-xs xl:text-sm font-medium tracking-widest uppercase transition-colors duration-200 ${
          active || open ? "text-primary" : "text-[#F0EAD8] hover:text-primary"
        }`}
      >
        {group.label}
        <ChevronDown
          aria-hidden="true"
          className={`size-3.5 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* The padded wrapper bridges the gap between trigger and panel so the
          pointer never leaves the group on the way down. */}
      <div
        className={`absolute left-0 top-full pt-4 transition-[opacity,transform] duration-200 ${
          open
            ? "opacity-100 translate-y-0"
            : "invisible opacity-0 -translate-y-1"
        }`}
      >
        <ul className="min-w-56 list-none bg-[#0A0F1E] border border-[rgba(232,160,32,0.35)] shadow-xl shadow-black/30 py-2">
          {group.items.map((item) => {
            const itemActive = isNavItemActive(item.href, pathname);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={itemActive ? "page" : undefined}
                  onClick={() => onOpenChange(false)}
                  className={`block px-5 py-3 text-xs font-medium tracking-widest uppercase transition-colors duration-200 ${
                    itemActive
                      ? "text-primary bg-white/5"
                      : "text-[#F0EAD8] hover:text-primary hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </li>
  );
}
