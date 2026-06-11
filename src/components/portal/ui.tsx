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
    <div className="px-6 md:px-12 pt-10 md:pt-14 pb-2">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-bebas text-5xl md:text-6xl text-[#0A0F1E] leading-[0.95]">
          {title}
        </h1>
        {subtitle ? (
          <p className="serif-display italic text-[#4A4E5C] mt-2 text-lg">
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Constrained content wrapper used by every portal screen body. */
export function PortalBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-6 md:px-12 py-10 md:py-12">
      <div className="max-w-5xl mx-auto space-y-12">{children}</div>
    </section>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white border border-[#0A0F1E]/10 shadow-[0_1px_3px_rgba(10,15,30,0.04)] ${className}`}
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
    <Card className="p-5">
      <div className="font-bebas text-4xl md:text-5xl text-[#0A0F1E] leading-none">
        {value}
      </div>
      <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4A4E5C]">
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
    <div className="flex items-baseline justify-between mb-5 border-b border-[#0A0F1E]/10 pb-3">
      <h2 className="font-bebas text-2xl md:text-3xl text-[#0A0F1E] tracking-wide">
        {children}
      </h2>
      {action ? (
        <Link
          href={action.href}
          className="text-xs uppercase tracking-[0.2em] text-[#E8A020] hover:underline shrink-0"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-[#0A0F1E]/5 text-[#4A4E5C]",
  verified: "bg-blue-50 text-blue-700",
  qualified: "bg-[rgba(232,160,32,0.14)] text-[#8a5e0e]",
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
