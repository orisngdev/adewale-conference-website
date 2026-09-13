import type { PaperExamPhase } from "@/lib/paper-exam";

const TONE: Record<PaperExamPhase["tone"], string> = {
  neutral: "bg-foreground/5 text-muted-foreground",
  progress: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  done: "bg-primary/10 text-primary",
};

export function PaperExamPhaseBadge({
  phase,
  className,
}: {
  phase: PaperExamPhase;
  className?: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${TONE[phase.tone]} ${className ?? ""}`}
      title={phase.hint}
    >
      {phase.label}
    </span>
  );
}
