import "server-only";
import { createClient } from "@/supabase/server";
import type { PracticeQuestion } from "@/components/portal/practice-runner";

// The one place the Practice/Exam split lives in TypeScript. The SQL layer is
// the security boundary (ADR-0002/0003): get_practice_bank is the ONLY function
// that emits correct answers, get_assessment strips them, and grading is
// server-side. This module just owns which of those RPCs a surface calls and the
// UI-side competition gate — so a new assessment surface asks here instead of
// re-deriving the mode by hand.

// ── Exam competition gate (mirrors start_exam_attempt) ──────────────────────
export type ExamGate =
  | { open: true }
  | { open: false; reason: "under_review" | "not_selected" };

// Graded exams open once a school's entry is accepted. 'submitted' is still
// under review; 'declined' means not selected. Everything else — an accepted
// tier, or a student with no school — is open. Practice never locks. This is the
// UI half; start_exam_attempt enforces the same rule server-side.
export function examGate(status: string | null | undefined): ExamGate {
  if (status === "submitted") return { open: false, reason: "under_review" };
  if (status === "declined") return { open: false, reason: "not_selected" };
  return { open: true };
}

// ── Practice: answer-bearing, client-marked (get_practice_bank) ─────────────
export interface PracticeBank {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  time_limit_minutes: number | null;
  content_version: number;
  questions: PracticeQuestion[];
}

// The only practice fetch. Returns null when the id isn't a published practice
// assessment (the RPC is mode-locked, so an exam id yields nothing).
export async function loadPracticeBank(id: string): Promise<PracticeBank | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_practice_bank", { p_id: id });
  const bank = data as PracticeBank | null;
  if (!bank || bank.questions.length === 0) return null;
  return bank;
}

// ── Exam: answer-stripped, server-graded (get_assessment) ───────────────────
export interface ExamAssessment {
  id: string;
  title: string;
  mode: "practice" | "exam";
  subject: string | null;
  level: string | null;
  max_attempts: number;
  time_limit_minutes: number | null;
  questions: { id: string; prompt: string; options: string[] }[];
}

// The only exam fetch — get_assessment never emits correct_index. Returns null
// when the id has no questions.
export async function loadExamAssessment(id: string): Promise<ExamAssessment | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_assessment", { p_id: id });
  const a = data as ExamAssessment | null;
  if (!a || a.questions.length === 0) return null;
  return a;
}
