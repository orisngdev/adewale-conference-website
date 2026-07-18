// Multi-type challenges — shared types and helpers for the arena engine.
// Four kinds of entry: data (auto-scored, its own arena UI), pitch (canvas
// snapshot), text (write-up) and link. See supabase/migrations/…_challenge_types.

export type ChallengeType = "data" | "pitch" | "text" | "link";

export const CHALLENGE_TYPES: ChallengeType[] = ["data", "pitch", "text", "link"];

// Types an admin can author from the portal. Data challenges need a hidden
// ground-truth set, so they're seeded via SQL / the arena — not this UI.
export const AUTHORABLE_TYPES: ChallengeType[] = ["pitch", "text", "link"];

// One glyph language everywhere (matches the approved design):
//   ▦ data · ◧ pitch · ¶ write-up · ↗ link
export const CHALLENGE_TYPE_GLYPH: Record<ChallengeType, string> = {
  data: "▦",
  pitch: "◧",
  text: "¶",
  link: "↗",
};

export const CHALLENGE_TYPE_LABEL: Record<ChallengeType, string> = {
  data: "Data",
  pitch: "Pitch",
  text: "Write-up",
  link: "Link",
};

// Short helper text shown under each option in the admin type picker.
export const CHALLENGE_TYPE_HINT: Record<ChallengeType, string> = {
  data: "Auto-scored on a hidden test set — authored via the arena.",
  pitch: "Students submit a snapshot of their Pitch Studio canvas.",
  text: "Students write a response in a text box.",
  link: "Students submit a URL (a video, doc, or repo).",
};

export function isChallengeType(value: unknown): value is ChallengeType {
  return typeof value === "string" && (CHALLENGE_TYPES as string[]).includes(value);
}

// ── Entry payloads ──────────────────────────────────────────────────────────
export interface CanvasNote {
  id?: string;
  text: string;
}
export type CanvasData = Record<string, CanvasNote[]>;

export type PitchPayload = { canvas: CanvasData };
export type TextPayload = { text: string };
export type LinkPayload = { url: string; label?: string | null };
export type EntryPayload = PitchPayload | TextPayload | LinkPayload;

export interface ChallengeEntry {
  id: string;
  challenge_id: string;
  student_user_id: string;
  payload: EntryPayload;
  note: string | null;
  submitted_at: string;
  status: "submitted" | "reviewed";
  score: number | null;
  feedback: string | null;
  reviewed_at: string | null;
}

// Narrowing accessors — payloads come back as untyped jsonb.
export function pitchCanvas(payload: unknown): CanvasData {
  const canvas = (payload as PitchPayload | null)?.canvas;
  return canvas && typeof canvas === "object" ? canvas : {};
}
export function textBody(payload: unknown): string {
  const text = (payload as TextPayload | null)?.text;
  return typeof text === "string" ? text : "";
}
export function linkFields(payload: unknown): { url: string; label: string } {
  const p = (payload as LinkPayload | null) ?? { url: "" };
  return { url: typeof p.url === "string" ? p.url : "", label: typeof p.label === "string" ? p.label : "" };
}

// ── Entry status chip (student's own entry) ─────────────────────────────────
export type EntryStatusChip = {
  label: string;
  tone: "grey" | "gold" | "green";
};

export function entryStatusChip(
  entry: { status: string; score: number | null } | null,
  hasDataSubmission = false,
): EntryStatusChip {
  if (entry) {
    if (entry.status === "reviewed") {
      return { label: `Reviewed${entry.score != null ? ` · ${entry.score}` : ""}`, tone: "green" };
    }
    return { label: "Submitted", tone: "gold" };
  }
  // Data challenges have no entries row — reflect whether they've competed.
  if (hasDataSubmission) return { label: "Entered", tone: "gold" };
  return { label: "Not entered", tone: "grey" };
}

// ── Deadlines ───────────────────────────────────────────────────────────────
// "Closes in 3 days · Aug 30" (< 7 days, turns red) · "Closes Sep 14" · "Closed Aug 10".
export function deadlineInfo(
  deadline: string | null,
  now: Date = new Date(),
): { label: string; soon: boolean; closed: boolean } {
  if (!deadline) return { label: "Open challenge", soon: false, closed: false };
  const d = new Date(deadline);
  const dateStr = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const ms = d.getTime() - now.getTime();
  if (ms <= 0) return { label: `Closed ${dateStr}`, soon: false, closed: true };
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 7) {
    return { label: `Closes in ${days} day${days === 1 ? "" : "s"} · ${dateStr}`, soon: true, closed: false };
  }
  return { label: `Closes ${dateStr}`, soon: false, closed: false };
}

export function isPastDeadline(deadline: string | null, now: Date = new Date()): boolean {
  return !!deadline && new Date(deadline).getTime() <= now.getTime();
}

// A short, plain-text summary for grid cards (strips light markdown, truncates).
export function challengeSummary(md: string | null, max = 150): string {
  if (!md) return "";
  const plain = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}

// Human date for "submitted Aug 21" / "Submitted Aug 21" lines.
export function shortDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
