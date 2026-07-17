// Guided Labs — shared types and helpers for the admin-authored lab engine.
// (The Future Tech Skills Lab is now just the first seeded lab; see
// supabase/migrations/…_labs.sql.)

export type LabStepKind = "lesson" | "video" | "link" | "quiz";

export interface Lab {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  track: string | null;
  sort: number;
  published: boolean;
  /** Optional embedded code-editor URL; when set, the player shows the drawer. */
  workbench_url?: string | null;
  created_at?: string;
}

export interface LabStep {
  id: string;
  lab_id: string;
  sort: number;
  key: string;
  title: string;
  kind: LabStepKind;
  body_md: string | null;
  media_url: string | null;
  link_label: string | null;
  duration_label: string | null;
  assessment_id: string | null;
}

// Curated, iframe-embeddable editors an admin can attach to a lab. Kept as a
// hardcoded dropdown so non-technical admins pick a tool instead of pasting a
// URL. All are confirmed embeddable (Trinket allows framing). Extend as needed.
export interface LabWorkbench {
  label: string;
  url: string;
}

export const LAB_WORKBENCHES: LabWorkbench[] = [
  { label: "Python", url: "https://trinket.io/embed/python3" },
  { label: "Web — HTML, CSS & JavaScript", url: "https://trinket.io/embed/html" },
];

// A published assessment offered in the admin quiz-lesson picker.
export interface QuizAssessmentOption {
  id: string;
  title: string;
  mode: string | null;
  subject: string | null;
  level: string | null;
}

// The seeded lab that owns the legacy tech-lab certificate + embedded IDE.
export const FUTURE_TECH_SLUG = "future-tech";

export const LAB_KINDS: LabStepKind[] = ["lesson", "video", "link", "quiz"];

// Syllabus-rail glyphs (per approved design): reading ¶ · video ▶ · tool ↗ · quiz ?
export const LAB_KIND_GLYPH: Record<LabStepKind, string> = {
  lesson: "¶",
  video: "▶",
  link: "↗",
  quiz: "?",
};

export const LAB_KIND_LABEL: Record<LabStepKind, string> = {
  lesson: "Reading",
  video: "Video",
  link: "External tool",
  quiz: "Quiz",
};

export type LabState = "not_started" | "in_progress" | "complete";

export function labState(done: number, total: number): LabState {
  if (total > 0 && done >= total) return "complete";
  if (done > 0) return "in_progress";
  return "not_started";
}

// A submitted attempt counts as passing when the score is ≥ 50% (or the quiz has
// no gradable questions). Used to auto-tick quiz lessons.
export function passedAssessmentIds(
  attempts: { assessment_id: string | null; score: number | null; total: number | null }[],
): Set<string> {
  const passed = new Set<string>();
  for (const a of attempts) {
    if (!a.assessment_id) continue;
    const total = a.total ?? 0;
    const score = a.score ?? 0;
    if (total > 0 ? score / total >= 0.5 : true) passed.add(a.assessment_id);
  }
  return passed;
}

// Turn a YouTube/Vimeo watch URL into its embeddable form; null if we can't.
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return url;
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (host === "player.vimeo.com") return url;
    return null;
  } catch {
    return null;
  }
}

// Where a quiz lesson's linked assessment is taken.
export function assessmentTakeHref(id: string, mode: string | null | undefined): string {
  return mode === "practice" ? `/portal/student/practice/${id}` : `/portal/cbt/${id}`;
}
