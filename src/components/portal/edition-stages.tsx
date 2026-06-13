// Horizontal stage stepper for an edition: done (navy) · current (gold) · upcoming (outline).
export function EditionStages({
  stages,
  current,
}: {
  stages: string[];
  current: string;
}) {
  const idx = stages.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {stages.map((stage, i) => {
        const done = idx >= 0 && i < idx;
        const isCurrent = i === idx;
        return (
          <li key={stage} className="flex items-center gap-2">
            <span
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide border ${
                isCurrent
                  ? "bg-[#E8A020] border-[#E8A020] text-[#0A0F1E]"
                  : done
                    ? "bg-[#0A0F1E] border-[#0A0F1E] text-white"
                    : "border-[#0A0F1E]/20 text-[#4A4E5C]"
              }`}
            >
              {stage}
            </span>
            {i < stages.length - 1 ? (
              <span className="text-[#0A0F1E]/25">→</span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function nextStage(stages: string[], current: string): string | null {
  const idx = stages.indexOf(current);
  if (idx < 0 || idx >= stages.length - 1) return null;
  return stages[idx + 1];
}
