import Link from "next/link";
import type { ResourceFilters } from "@/sanity/types";

type Option = { value: string; label: string };

const TYPE_OPTIONS: Option[] = [
  { value: "", label: "All" },
  { value: "past-question", label: "Past questions" },
  { value: "study-guide", label: "Study guides" },
  { value: "syllabus", label: "Syllabus" },
  { value: "video", label: "Videos" },
];

const LEVEL_OPTIONS: Option[] = [
  { value: "", label: "All" },
  { value: "SS1", label: "SS1" },
  { value: "SS2", label: "SS2" },
];

function hrefWith(current: ResourceFilters, key: keyof ResourceFilters, value: string) {
  const next: ResourceFilters = { ...current, [key]: value };
  const sp = new URLSearchParams();
  if (next.type) sp.set("type", next.type);
  if (next.subject) sp.set("subject", next.subject);
  if (next.level) sp.set("level", next.level);
  const qs = sp.toString();
  return qs ? `/resources?${qs}` : "/resources";
}

function FilterGroup({
  label,
  paramKey,
  options,
  current,
}: {
  label: string;
  paramKey: keyof ResourceFilters;
  options: Option[];
  current: ResourceFilters;
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

export default function FilterBar({
  current,
  subjects,
}: {
  current: ResourceFilters;
  subjects: string[];
}) {
  const subjectOptions: Option[] = [
    { value: "", label: "All" },
    ...subjects.map((s) => ({ value: s, label: s })),
  ];

  return (
    <div className="space-y-5 mb-10">
      <FilterGroup label="Type" paramKey="type" options={TYPE_OPTIONS} current={current} />
      <FilterGroup label="Level" paramKey="level" options={LEVEL_OPTIONS} current={current} />
      {subjects.length > 0 ? (
        <FilterGroup label="Subject" paramKey="subject" options={subjectOptions} current={current} />
      ) : null}
    </div>
  );
}
