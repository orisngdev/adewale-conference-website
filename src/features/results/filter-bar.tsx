import Link from "next/link";

export interface ResultsFilters {
  year: string;
  category: string;
  zone: string;
}

type Option = { value: string; label: string };

function hrefWith(
  current: ResultsFilters,
  key: keyof ResultsFilters,
  value: string,
) {
  const next: ResultsFilters = { ...current, [key]: value };
  const sp = new URLSearchParams();
  if (next.year) sp.set("year", next.year);
  if (next.category) sp.set("category", next.category);
  if (next.zone) sp.set("zone", next.zone);
  const qs = sp.toString();
  return qs ? `/results?${qs}` : "/results";
}

function FilterGroup({
  label,
  paramKey,
  options,
  current,
}: {
  label: string;
  paramKey: keyof ResultsFilters;
  options: Option[];
  current: ResultsFilters;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#4A4E5C] mb-2">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = (current[paramKey] || "") === option.value;
          return (
            <Link
              key={option.value || "all"}
              href={hrefWith(current, paramKey, option.value)}
              aria-current={active ? "true" : undefined}
              className={`text-xs font-bold tracking-[0.12em] uppercase px-3 py-1.5 border transition-colors ${
                active
                  ? "bg-[#0A0F1E] border-[#0A0F1E] text-[#E8A020]"
                  : "border-[rgba(10,15,30,0.2)] text-[#0A0F1E] hover:border-[#E8A020]"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ResultsFilterBar({
  current,
  years,
  categories,
  zones,
}: {
  current: ResultsFilters;
  years: number[];
  categories: string[];
  zones: string[];
}) {
  const withAll = (opts: Option[]): Option[] => [
    { value: "", label: "All" },
    ...opts,
  ];

  return (
    <div className="space-y-5 mb-12">
      <FilterGroup
        label="Edition"
        paramKey="year"
        options={withAll(years.map((y) => ({ value: String(y), label: String(y) })))}
        current={current}
      />
      <FilterGroup
        label="Subject"
        paramKey="category"
        options={withAll(categories.map((c) => ({ value: c, label: c })))}
        current={current}
      />
      {zones.length > 0 ? (
        <FilterGroup
          label="Zone"
          paramKey="zone"
          options={withAll(zones.map((z) => ({ value: z, label: z })))}
          current={current}
        />
      ) : null}
    </div>
  );
}
