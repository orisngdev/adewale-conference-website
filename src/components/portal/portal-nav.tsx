"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/supabase/client";

export interface PortalTab {
  href: string;
  label: string;
}

export default function PortalNav({
  email,
  tabs,
}: {
  email: string | null;
  tabs: PortalTab[];
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
      <div className="bg-[#0A0F1E] px-6 md:px-12 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link
            href="/"
            className="font-bebas text-2xl text-white tracking-wide"
          >
            ASC <span className="text-[#E8A020]">Portal</span>
          </Link>
          <div className="flex items-center gap-5">
            {email ? (
              <span className="hidden sm:block text-xs text-[rgba(250,247,240,0.6)]">
                {email}
              </span>
            ) : null}
            {email ? (
              <button
                type="button"
                onClick={signOut}
                className="text-xs uppercase tracking-[0.2em] text-[#E8A020] hover:text-white transition-colors"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/"
                className="text-xs uppercase tracking-[0.2em] text-[rgba(250,247,240,0.7)] hover:text-white"
              >
                ← Main site
              </Link>
            )}
          </div>
        </div>
      </div>

      {tabs.length > 0 ? (
        <nav className="bg-white border-b border-[#0A0F1E]/10 px-6 md:px-12">
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
                      ? "border-[#E8A020] text-[#0A0F1E] font-medium"
                      : "border-transparent text-[#4A4E5C] hover:text-[#0A0F1E]"
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
