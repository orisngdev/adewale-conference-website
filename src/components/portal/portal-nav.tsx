"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";
import InstallAppButton from "@/components/pwa/install-app-button";

export interface PortalTab {
  href: string;
  label: string;
}

export default function PortalNav({
  email,
  tabs,
  unread = 0,
}: {
  email: string | null;
  tabs: PortalTab[];
  unread?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <header>
      <div className="bg-foreground px-6 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-bebas text-2xl text-white tracking-wide"
          >
            ASC <span className="text-primary">Portal</span>
          </Link>
          <div className="flex items-center gap-4">
            <InstallAppButton />
            {email && unread > 0 ? (
              <span
                className="inline-flex items-center gap-1 text-xs font-bold text-primary"
                title={`${unread} unread notification${unread === 1 ? "" : "s"}`}
              >
                🔔 {unread}
              </span>
            ) : null}
            {email ? (
              <span className="hidden sm:block text-xs text-background/60">
                {email}
              </span>
            ) : null}
            {email ? (
              <button
                type="button"
                onClick={signOut}
                className="text-xs uppercase tracking-[0.2em] text-primary hover:text-white transition-colors"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/"
                className="text-xs uppercase tracking-[0.2em] text-background/70 hover:text-white"
              >
                ← Main site
              </Link>
            )}
          </div>
        </div>
      </div>

      {tabs.length > 0 ? (
        <nav className="bg-card border-b border-foreground/10 px-6 md:px-12">
          <div className="max-w-5xl mx-auto flex gap-6 overflow-x-auto">
            {tabs.map((t) => {
              const active =
                t.href === "/portal"
                  ? pathname === "/portal"
                  : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`py-4 text-sm tracking-wide border-b-2 -mb-px whitespace-nowrap transition-colors ${
                    active
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
