const credentials = [
  "Stanford Connection",
  "Y Combinator Network",
  // "Adjunct Lecturer · UNILAG",
  // "Co-Founder · OEIC",
  // "Remo, Ogun State",
];

export default function FounderSection() {
  return (
    <section
      id="founder"
      className="bg-[#FAF7F0] py-14 md:py-16 px-6 md:px-12"
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-10 lg:gap-16 items-start">
        <div className="md:col-span-2 flex flex-col">
          <div className="relative aspect-3/4 overflow-hidden">
            <img
              src="/assets/founder.jpg"
              alt="Michael Adewale Adesanya portrait"
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="bg-[#0A0F1E] border-t-2 border-[#E8A020] p-5">
            <div className="font-bebas text-xl md:text-2xl text-primary tracking-wide leading-tight">
              Michael Adewale Adesanya
            </div>
            <div className="mt-2 text-[10px] md:text-xs font-medium tracking-[0.15em] uppercase text-[rgba(240,234,216,0.65)]">
              Covener, Adewale Students Conference
            </div>
          </div>
        </div>

        <div className="md:col-span-3 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <span className="block w-6 h-px bg-[#E8A020]" />
            <span className="text-xs font-bold tracking-[0.3em] uppercase text-primary">
              The Founder
            </span>
          </div>

          <h2 className="font-bebas text-5xl md:text-6xl lg:text-7xl leading-[0.95] text-foreground mb-8">
            <span className="block">Built From</span>
            <span className="block">Conviction.</span>
          </h2>

          <blockquote className="serif-display italic text-base md:text-lg text-foreground leading-relaxed border-l-2 border-[#E8A020] pl-5 mb-8">
            &ldquo;I started this because I knew what it felt like to be the brightest person in the room with no room to grow. ASC is the room I wish I had.&rdquo;
          </blockquote>

          <div className="space-y-4 text-sm md:text-base leading-relaxed text-[#3C4150] mb-8 max-w-prose">
            <p>
              Michael Adewale Adesanya is a politician, educator, and innovation advocate from Remo, Ogun State. With roots across Sagamu, Ikenne, and Remo North, he has spent the last decade building at the intersection of technology, education, and community development.
            </p>
            <p>
              Michael brings four years of Silicon Valley experience, including connections forged at Stanford University and Y Combinator, back to Ogun State channelling that exposure into programmes and institutions that serve young people at the grassroots. He serves as an Adjunct Lecturer in Engineering Entrepreneurship at the University of Lagos.
            </p>
            <p>
              ASC is his most personal project a programme he has funded, run, and shown up for every year for five consecutive years. In 2026, he is taking the hardest step any founder can take: building the structure that makes it bigger than him.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {credentials.map((tag) => (
              <span
                key={tag}
                className="inline-block bg-[#0A0F1E] text-primary px-2 py-1.5 md:px-3 md:py-2 text-[9px] md:text-xs font-bold tracking-widest md:tracking-[0.2em] uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
