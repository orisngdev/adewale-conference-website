import Link from "next/link";
import { getUserRole } from "@/supabase/auth";

// Shown only to admins viewing a student-facing page (via "Preview as student"),
// so it's obvious they're in the student view — not looking at a real student —
// and there's a one-click way back to the builder. Renders nothing for students.
export default async function AdminPreviewBanner({
  backHref,
  label = "admin",
}: {
  backHref: string;
  label?: string;
}) {
  if ((await getUserRole()) !== "admin") return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#10182E] text-white px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2">
        <span aria-hidden>👁</span>
        <span className="font-semibold">Admin preview</span>
        <span className="text-white/60">— you&apos;re seeing the student view, not a real student.</span>
      </span>
      <Link
        href={backHref}
        className="shrink-0 text-primary font-bold uppercase tracking-wide text-xs hover:underline"
      >
        ← Back to {label}
      </Link>
    </div>
  );
}
