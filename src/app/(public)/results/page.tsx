import EmptyState from "@/components/ui/empty-state";
import ResultsFilterBar, {
  type ResultsFilters,
} from "@/features/results/filter-bar";
import { pageMetadata } from "@/lib/seo";
import { sanityFetch } from "@/sanity/lib/live";
import { resultsQuery } from "@/sanity/lib/queries";
import type { ResultRow } from "@/sanity/types";

export const metadata = pageMetadata(
  "Hall of Fame",
  "Champions, finalists, and zonal winners across every edition of the Adewale Students Conference.",
);

type Rank = 0 | 1 | 2 | 3;

function rankOf(position?: string): Rank {
  if (!position) return 0;
  const p = position.toLowerCase();
  if (/1st|first|champion|gold|winner/.test(p) || p.startsWith("1")) return 1;
  if (/2nd|second|silver|runner/.test(p) || p.startsWith("2")) return 2;
  if (/3rd|third|bronze/.test(p) || p.startsWith("3")) return 3;
  return 0;
}

const MEDAL: Record<1 | 2 | 3, { color: string; label: string; name: string; ped: string; icon: string }> = {
  1: { color: "#E8A020", label: "1st", name: "Champion", ped: "h-14 sm:h-28", icon: "🏆" },
  2: { color: "#9CA3AF", label: "2nd", name: "Runner-up", ped: "h-10 sm:h-20", icon: "🥈" },
  3: { color: "#B45309", label: "3rd", name: "Third place", ped: "h-7 sm:h-14", icon: "🥉" },
};

interface CategoryGroup {
  category: string;
  rows: ResultRow[];
}
interface Edition {
  year: number;
  theme?: string;
  categories: CategoryGroup[];
  finalists: ResultRow[];
}

function buildEditions(rows: ResultRow[]): Edition[] {
  const byYear = new Map<number, ResultRow[]>();
  for (const row of rows) {
    const year = row.year ?? 0;
    byYear.set(year, [...(byYear.get(year) ?? []), row]);
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, list]) => {
      const finalists = list.filter((r) => rankOf(r.position) === 0);
      const podium = list.filter((r) => rankOf(r.position) !== 0);

      const catMap = new Map<string, ResultRow[]>();
      for (const r of podium) {
        const c = r.category ?? "General";
        catMap.set(c, [...(catMap.get(c) ?? []), r]);
      }
      const categories = [...catMap.entries()]
        .map(([category, rs]) => ({ category, rows: rs }))
        .sort((a, b) => a.category.localeCompare(b.category));

      return {
        year,
        theme: list.find((r) => r.theme)?.theme,
        categories,
        finalists,
      };
    });
}

function PodiumColumn({ row, rank }: { row: ResultRow; rank: 1 | 2 | 3 }) {
  const m = MEDAL[rank];
  return (
    <div className="flex-1 min-w-0">
      <div
        className="bg-white border-t-4 p-2 sm:p-4 text-center shadow-[0_1px_3px_rgba(10,15,30,0.05)]"
        style={{ borderTopColor: m.color }}
      >
        <div className="text-lg sm:text-2xl leading-none">{m.icon}</div>
        <span
          className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.2em] mt-1"
          style={{ color: m.color }}
        >
          {m.name}
        </span>
        <h4 className="font-bebas text-sm sm:text-2xl text-[#0A0F1E] mt-1 leading-tight break-words">
          {row.schoolName}
        </h4>
        {row.studentNames?.length ? (
          <p className="text-[11px] sm:text-sm text-[#4A4E5C] mt-1 leading-snug">
            {row.studentNames.join(", ")}
          </p>
        ) : null}
        {row.zone ? (
          <p className="hidden sm:block text-[10px] uppercase tracking-[0.15em] text-[#4A4E5C] mt-2">
            {row.zone} zone
          </p>
        ) : null}
      </div>
      {/* Pedestal */}
      <div
        className={`flex items-start justify-center ${m.ped}`}
        style={{ background: m.color }}
      >
        <span className="font-bebas text-xl sm:text-4xl text-white/85 mt-1 sm:mt-2">
          {m.label}
        </span>
      </div>
    </div>
  );
}

function CategoryPodium({ group }: { group: CategoryGroup }) {
  const first = group.rows.find((r) => rankOf(r.position) === 1);
  const second = group.rows.find((r) => rankOf(r.position) === 2);
  const third = group.rows.find((r) => rankOf(r.position) === 3);

  return (
    <div>
      <h3 className="flex items-center gap-3 mb-5">
        <span className="font-bebas text-2xl text-[#0A0F1E] tracking-wide">
          {group.category}
        </span>
        <span className="h-px flex-1 bg-[rgba(10,15,30,0.12)]" />
      </h3>
      <div className="flex items-end gap-2 sm:gap-4">
        {second ? <PodiumColumn row={second} rank={2} /> : null}
        {first ? <PodiumColumn row={first} rank={1} /> : null}
        {third ? <PodiumColumn row={third} rank={3} /> : null}
      </div>
    </div>
  );
}

type Props = {
  searchParams: Promise<{ year?: string; category?: string; zone?: string }>;
};

export default async function ResultsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const filters: ResultsFilters = {
    year: sp.year ?? "",
    category: sp.category ?? "",
    zone: sp.zone ?? "",
  };

  const { data } = await sanityFetch({ query: resultsQuery });
  const allRows = (data ?? []) as ResultRow[];

  // Facets from the full dataset so dropdowns stay complete while filtering.
  const years = [...new Set(allRows.map((r) => r.year ?? 0))]
    .filter(Boolean)
    .sort((a, b) => b - a);
  const categories = [...new Set(allRows.map((r) => r.category).filter(Boolean))].sort() as string[];
  const zones = [...new Set(allRows.map((r) => r.zone).filter(Boolean))].sort() as string[];

  const rows = allRows.filter(
    (r) =>
      (!filters.year || String(r.year) === filters.year) &&
      (!filters.category || r.category === filters.category) &&
      (!filters.zone || r.zone === filters.zone),
  );
  const editions = buildEditions(rows);
  const hasFilters = Boolean(filters.year || filters.category || filters.zone);

  const champions = rows.filter((r) => rankOf(r.position) === 1).length;
  const schools = new Set(rows.map((r) => r.schoolName).filter(Boolean)).size;
  const students = new Set(rows.flatMap((r) => r.studentNames ?? [])).size;

  const stats = [
    { value: editions.length, label: "Editions" },
    { value: champions, label: "Champions" },
    { value: schools, label: "Schools" },
    { value: students, label: "Students" },
  ];

  return (
    <>
      {/* Dramatic hero */}
      <header className="bg-[#0A0F1E] px-6 md:px-12 py-16 md:py-24 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-10 right-0 font-bebas text-[12rem] md:text-[18rem] leading-none text-[rgba(232,160,32,0.06)] select-none pointer-events-none"
        >
          ★
        </div>
        <div className="max-w-5xl mx-auto relative">
          <span className="inline-block border border-[#E8A020] bg-[rgba(232,160,32,0.08)] px-4 py-2 mb-6 text-[10px] md:text-xs font-bold tracking-[0.25em] uppercase text-[#E8A020]">
            The Champions
          </span>
          <h1 className="font-bebas text-6xl md:text-8xl leading-[0.9] text-white">
            Hall of Fame
          </h1>
          <p className="serif-display text-base md:text-lg italic text-[rgba(250,247,240,0.7)] max-w-2xl mt-5 leading-relaxed">
            Every champion, runner-up, and finalist the Adewale Students Conference has
            crowned — enshrined edition by edition.
          </p>
          {rows.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.1)] mt-10">
              {stats.map((s) => (
                <div key={s.label} className="bg-[#0A0F1E] p-5">
                  <div className="font-bebas text-4xl md:text-5xl text-[#E8A020] leading-none">
                    {s.value}
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-[rgba(250,247,240,0.6)] mt-2">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          {allRows.length > 0 ? (
            <ResultsFilterBar
              current={filters}
              years={years}
              categories={categories}
              zones={zones}
            />
          ) : null}
          {editions.length === 0 ? (
            <EmptyState title={hasFilters ? "No matching results" : "No results yet"}>
              {hasFilters
                ? "Nothing matches these filters yet — try clearing them."
                : "Champions published in the Studio will be enshrined here, edition by edition."}
            </EmptyState>
          ) : (
            <div className="space-y-24">
              {editions.map((edition) => (
                <div key={edition.year}>
                  {/* Edition divider */}
                  <div className="flex items-end gap-4 border-b-2 border-[#0A0F1E] pb-3 mb-10">
                    <span className="font-bebas text-6xl md:text-7xl leading-none text-[#0A0F1E]">
                      {edition.year || "—"}
                    </span>
                    {edition.theme ? (
                      <span className="serif-display italic text-base md:text-lg text-[#4A4E5C] mb-1">
                        {edition.theme}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-12">
                    {edition.categories.map((group) => (
                      <CategoryPodium key={group.category} group={group} />
                    ))}
                  </div>

                  {/* Finalists */}
                  {edition.finalists.length > 0 ? (
                    <div className="mt-12">
                      <h3 className="font-bebas text-2xl text-[#0A0F1E] mb-4">
                        Finalists
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {edition.finalists.map((row) => (
                          <span
                            key={row._id}
                            className="inline-flex items-center gap-2 border border-[rgba(10,15,30,0.12)] bg-white px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-[#0A0F1E]">
                              {row.schoolName}
                            </span>
                            {row.category ? (
                              <span className="text-[10px] uppercase tracking-[0.15em] text-[#4A4E5C]">
                                {row.category}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
