import { Eye } from "lucide-react";

// Shown on admin pages a teammate can view but not manage. It signals that the
// create/edit/approve/delete controls are intentionally absent — the account has
// read-only access to this module (enforced server-side too; see
// canManageModule in @/supabase/auth).
export function ReadOnlyBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground ${className}`}
      title="You have read-only access to this section"
    >
      <Eye className="size-3.5" strokeWidth={2.2} />
      Read-only
    </span>
  );
}
