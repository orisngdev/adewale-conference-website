"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/portal/admin", label: "Overview", exact: true },
  { href: "/portal/admin/registrations", label: "Registrations" },
  { href: "/portal/admin/users", label: "Users" },
  { href: "/portal/admin/sponsors", label: "Sponsors" },
  { href: "/portal/admin/schools", label: "Schools" },
  { href: "/portal/admin/participants", label: "Participants" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="px-6 md:px-12 pt-8">
      <div className="max-w-5xl mx-auto flex gap-2 overflow-x-auto pb-1">
        {LINKS.map((l) => {
          const active = l.exact
            ? pathname === l.href
            : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-2 text-sm whitespace-nowrap border transition-colors ${
                active
                  ? "bg-[#0A0F1E] text-white border-[#0A0F1E]"
                  : "bg-white text-[#4A4E5C] border-[#0A0F1E]/15 hover:border-[#0A0F1E]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
