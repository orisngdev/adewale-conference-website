import Link from "next/link";

/** Page intro for portal screens — lighter than the public navy PageHeader. */
export function PortalHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="px-5 md:px-10 pt-6 md:pt-8 pb-1">
      <div className="max-w-6xl mx-auto">
        <h1 className="font-bebas text-4xl md:text-5xl text-foreground leading-[0.95]">
          {title}
        </h1>
        {subtitle ? (
          <p className="serif-display italic text-muted-foreground mt-1">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

/** Constrained content wrapper used by top-level portal screens (admin, cbt). */
export function PortalBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-5 md:px-10 py-6 md:py-8">
      <div className="max-w-6xl mx-auto space-y-8">{children}</div>
    </section>
  );
}

export function Card({
  children,
  className = "",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Adds a hover lift for cards that are themselves links/buttons. */
  interactive?: boolean;
}) {
  return (
    <div
      className={`bg-card shadow-[0_1px_3px_rgba(10,15,30,0.07)] ${
        interactive
          ? "transition-shadow hover:shadow-[0_10px_28px_-12px_rgba(10,15,30,0.20)]"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function StatTile({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card className="p-5 min-w-0">
      <div className="font-bebas text-3xl md:text-5xl text-foreground leading-none wrap-break-word">
        {value}
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
    </Card>
  );
}

export function SectionHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex items-baseline justify-between mb-5 border-b border-border pb-3">
      <h2 className="font-bebas text-2xl md:text-3xl text-foreground tracking-wide">
        {children}
      </h2>
      {action ? (
        <Link
          href={action.href}
          className="text-xs uppercase tracking-[0.2em] text-primary hover:underline shrink-0"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Standard page scaffold for screens rendered INSIDE a sub-layout (school /
 * student), which already provides the outer frame + sidebar. Gives every such
 * page one consistent header (back link + title + actions) so there's a single
 * way to build a page — no more double-wrapping with PortalHeader/PortalBody.
 */
export function PageShell({
  title,
  subtitle,
  actions,
  back,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {back ? (
        <Link
          href={back.href}
          className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
        >
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bebas text-2xl md:text-3xl text-foreground leading-tight">{title}</h2>
          {subtitle ? <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** Consistent empty-state message + optional CTA. */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center py-10 px-4">
      <p className="serif-display italic text-muted-foreground">{title}</p>
      {children ? <div className="mt-3 flex justify-center">{children}</div> : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-foreground/5 text-muted-foreground",
  verified: "bg-blue-50 text-blue-700",
  qualified: "bg-primary/[0.14] text-gold-ink",
  finalist: "bg-green-50 text-green-700",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? STATUS_STYLES.submitted;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${cls}`}
    >
      {status}
    </span>
  );
}
