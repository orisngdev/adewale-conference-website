"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal, X, type LucideIcon } from "lucide-react";

export type NavLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  /** Short label for the mobile bottom bar (falls back to label). */
  short?: string;
};

export type SidebarConfig = {
  ariaLabel: string;
  /** Standalone item pinned above the groups (e.g. Overview). */
  overview: NavLink;
  /** Desktop rail groups. A group with an empty title renders no header. */
  groups: { title: string; links: NavLink[] }[];
  /** Mobile bottom-bar primary tabs (4–5). */
  bottom: NavLink[];
  /** Mobile overflow, shown in a "More" sheet. Omit/empty for no More tab. */
  more?: NavLink[];
};

function isActive(pathname: string, l: NavLink) {
  return l.exact ? pathname === l.href : pathname.startsWith(l.href);
}

/* ---------- Desktop: sticky white rail ---------- */

function RailItem({ link, active }: { link: NavLink; active: boolean }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-11 text-sm transition-colors ${
        active
          ? "bg-primary/15 text-gold-ink font-semibold"
          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
      }`}
    >
      <Icon className={`size-[18px] shrink-0 ${active ? "text-gold-ink" : "text-muted-foreground"}`} strokeWidth={2} />
      <span>{link.label}</span>
    </Link>
  );
}

function DesktopRail({ config, pathname }: { config: SidebarConfig; pathname: string }) {
  return (
    <nav
      aria-label={config.ariaLabel}
      className="hidden md:flex md:flex-col gap-0.5 bg-card p-3 sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto"
    >
      <RailItem link={config.overview} active={isActive(pathname, config.overview)} />
      {config.groups.map((g, i) => (
        <div key={g.title || i}>
          {g.title ? (
            <p className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {g.title}
            </p>
          ) : (
            <div className="pt-1" />
          )}
          {g.links.map((l) => (
            <RailItem key={l.href} link={l} active={isActive(pathname, l)} />
          ))}
        </div>
      ))}
    </nav>
  );
}

/* ---------- Mobile: fixed bottom tab bar + More sheet ---------- */

function BottomTab({
  href,
  label,
  icon: Icon,
  active,
  onClick,
  expanded,
}: {
  href?: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const cls = `flex-1 flex flex-col items-center justify-center gap-1 min-h-[3.25rem] px-1 pt-2 pb-1 ${
    active ? "text-gold-ink" : "text-muted-foreground"
  }`;
  const inner = (
    <>
      <Icon className="size-[22px] shrink-0" strokeWidth={active ? 2.4 : 2} />
      <span className={`text-[10px] leading-none ${active ? "font-semibold" : ""}`}>{label}</span>
    </>
  );
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-expanded={expanded} className={cls}>
      {inner}
    </button>
  );
}

function MobileBottomNav({ config, pathname }: { config: SidebarConfig; pathname: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const more = config.more ?? [];
  const moreActive = more.some((l) => isActive(pathname, l)) || moreOpen;

  return (
    <>
      {moreOpen ? (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="More sections">
          <button type="button" aria-label="Close" onClick={() => setMoreOpen(false)} className="absolute inset-0 bg-foreground/40" />
          <div className="absolute inset-x-0 bottom-0 bg-card rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-6px_28px_rgba(10,15,30,0.22)]">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bebas text-xl text-foreground tracking-wide">More</p>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {more.map((l) => {
                const Icon = l.icon;
                const active = isActive(pathname, l);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 min-h-12 text-sm ${
                      active ? "bg-primary/15 text-gold-ink font-semibold" : "bg-foreground/[0.03] text-foreground"
                    }`}
                  >
                    <Icon className={`size-5 shrink-0 ${active ? "text-gold-ink" : "text-muted-foreground"}`} strokeWidth={2} />
                    <span>{l.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <nav
        aria-label={config.ariaLabel}
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card border-t border-foreground/10 shadow-[0_-1px_10px_rgba(10,15,30,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="flex">
          {config.bottom.map((l) => (
            <BottomTab key={l.href} href={l.href} icon={l.icon} label={l.short ?? l.label} active={isActive(pathname, l)} />
          ))}
          {more.length > 0 ? (
            <BottomTab icon={MoreHorizontal} label="More" active={moreActive} expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)} />
          ) : null}
        </div>
      </nav>
    </>
  );
}

export default function PortalSidebar({ config }: { config: SidebarConfig }) {
  const pathname = usePathname();
  return (
    <>
      <DesktopRail config={config} pathname={pathname} />
      <MobileBottomNav config={config} pathname={pathname} />
    </>
  );
}
