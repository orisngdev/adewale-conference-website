import { BMC_BLOCKS } from "@/lib/pitch-studio";
import {
  CHALLENGE_TYPE_GLYPH,
  CHALLENGE_TYPE_LABEL,
  pitchCanvas,
  type CanvasData,
  type ChallengeType,
  type EntryStatusChip,
} from "@/lib/challenges";

// Outlined type badge — one glyph language across student + admin screens.
// `suffix` appends the metric for data challenges (e.g. "Data · RMSE").
export function ChallengeTypeBadge({
  type,
  suffix,
}: {
  type: ChallengeType;
  suffix?: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-foreground/15 px-2 py-1 text-[9.5px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
      <span aria-hidden className="text-[11px] text-gold-ink">
        {CHALLENGE_TYPE_GLYPH[type]}
      </span>
      {CHALLENGE_TYPE_LABEL[type]}
      {suffix ? ` · ${suffix}` : ""}
    </span>
  );
}

const CHIP_TONE: Record<EntryStatusChip["tone"], string> = {
  grey: "bg-foreground/6 text-muted-foreground",
  gold: "bg-primary/[0.14] text-gold-ink",
  green: "bg-green-600/12 text-green-700",
};

// Status/summary chip in the shared challenge palette.
export function ChallengeChip({
  label,
  tone,
}: {
  label: string;
  tone: EntryStatusChip["tone"];
}) {
  return (
    <span
      className={`inline-block px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.18em] ${CHIP_TONE[tone]}`}
    >
      {label}
    </span>
  );
}

// Read-only Business Model Canvas snapshot — the pitch entry payload rendered as
// a compact grid. Shared by the student detail page and the admin review page.
export function BmcSnapshot({ payload }: { payload: unknown }) {
  const canvas: CanvasData = pitchCanvas(payload);
  const filled = BMC_BLOCKS.filter((b) => (canvas[b.key] ?? []).some((n) => n.text.trim()));
  const blocks = filled.length ? filled : BMC_BLOCKS;

  return (
    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3 rounded-md border border-foreground/6 bg-background p-2.5">
      {blocks.map((b) => {
        const notes = (canvas[b.key] ?? []).map((n) => n.text.trim()).filter(Boolean);
        return (
          <div key={b.key} className="min-h-11 border border-foreground/6 bg-card p-2">
            <span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-gold-ink">
              {b.title}
            </span>
            {notes.length ? (
              <span className="mt-1 block space-y-1 text-[11px] leading-snug text-muted-foreground">
                {notes.map((t, i) => (
                  <span key={i} className="block">
                    {t}
                  </span>
                ))}
              </span>
            ) : (
              <span className="mt-1 block text-[11px] italic text-muted-foreground/60">—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { CHALLENGE_TYPE_LABEL };
