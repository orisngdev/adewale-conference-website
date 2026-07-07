/** Temporary placeholder body for scaffolded pages, replaced as each phase lands. */
export default function ComingSoon({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-6 md:px-12 py-16 md:py-24">
      <div className="max-w-3xl mx-auto">
        <span className="inline-block bg-[#E8A020] text-foreground text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 mb-6">
          In progress
        </span>
        <div className="serif-display text-lg md:text-xl italic text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </section>
  );
}
