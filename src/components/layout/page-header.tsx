interface PageHeaderProps {
  kicker?: string;
  title: string;
  subtitle?: string;
}

/** Brand-styled hero for inner platform pages (navy band, gold kicker). */
export default function PageHeader({ kicker, title, subtitle }: PageHeaderProps) {
  return (
    <header className="bg-[#0A0F1E] px-6 md:px-12 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        {kicker ? (
          <span className="inline-block border border-[#E8A020] bg-[rgba(232,160,32,0.08)] px-4 py-2 mb-6 text-[10px] md:text-xs font-bold tracking-[0.25em] uppercase text-primary">
            {kicker}
          </span>
        ) : null}
        <h1 className="font-bebas text-5xl md:text-7xl leading-[0.95] text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="serif-display text-base md:text-lg italic text-[rgba(250,247,240,0.7)] max-w-2xl mt-6 leading-relaxed">
            {subtitle}
          </p>
        ) : null}
      </div>
    </header>
  );
}
