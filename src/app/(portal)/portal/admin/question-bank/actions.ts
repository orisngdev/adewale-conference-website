"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/supabase/server";
import { requireManage } from "@/supabase/auth";

export interface ImportError {
  row: number;
  field: string;
  message: string;
}
export interface ImportState {
  stage: "idle" | "preview" | "done" | "error";
  message?: string;
  parsed?: number;
  valid?: number;
  inserted?: number;
  skipped?: number;
  errors?: ImportError[];
}

interface ParsedRow {
  mode: string;
  subject: string | null;
  level: string | null;
  topic: string | null;
  difficulty: string | null;
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  tags: string[];
  edition_year: number | null;
}

// Minimal quoted-CSV parser (handles embedded commas/quotes/newlines) — no dep.
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function coerceRow(
  raw: Record<string, string>,
  index: number,
  defaultMode: string,
  errors: ImportError[],
): ParsedRow | null {
  const prompt = (raw.prompt ?? "").trim();
  const options = [raw.option_1, raw.option_2, raw.option_3, raw.option_4]
    .map((o) => (o ?? "").trim())
    .filter(Boolean);
  const mode = (raw.mode || defaultMode).trim().toLowerCase();
  const correctRaw = Number(raw.correct);
  const correct_index = Number.isFinite(correctRaw) ? correctRaw - 1 : -1; // 1-based → 0-based
  const difficulty = (raw.difficulty ?? "").trim().toLowerCase() || null;

  let ok = true;
  if (!prompt) { errors.push({ row: index, field: "prompt", message: "empty prompt" }); ok = false; }
  if (options.length < 2) { errors.push({ row: index, field: "options", message: "need ≥2 options" }); ok = false; }
  if (correct_index < 0 || correct_index >= options.length) {
    errors.push({ row: index, field: "correct", message: "correct out of range (1-based)" }); ok = false;
  }
  if (mode !== "practice" && mode !== "exam") {
    errors.push({ row: index, field: "mode", message: "mode must be practice or exam" }); ok = false;
  }
  if (difficulty && !["easy", "medium", "hard"].includes(difficulty)) {
    errors.push({ row: index, field: "difficulty", message: "difficulty must be easy/medium/hard" }); ok = false;
  }
  if (!ok) return null;

  const yr = Number(raw.edition_year);
  return {
    mode,
    subject: (raw.subject ?? "").trim() || null,
    level: (raw.level ?? "").trim() || null,
    topic: (raw.topic ?? "").trim() || null,
    difficulty,
    prompt,
    options,
    correct_index,
    explanation: (raw.explanation ?? "").trim() || null,
    tags: (raw.tags ?? "").split("|").map((t) => t.trim()).filter(Boolean),
    edition_year: Number.isFinite(yr) && yr > 0 ? yr : null,
  };
}

function parsePayload(payload: string, defaultMode: string): { rows: ParsedRow[]; errors: ImportError[] } {
  const errors: ImportError[] = [];
  const rows: ParsedRow[] = [];
  const trimmed = payload.trim();
  if (!trimmed) return { rows, errors };

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    // JSON
    let arr: unknown;
    try { arr = JSON.parse(trimmed); } catch { errors.push({ row: 0, field: "json", message: "invalid JSON" }); return { rows, errors }; }
    const list = Array.isArray(arr) ? arr : [arr];
    list.forEach((item, i) => {
      const o = item as Record<string, unknown>;
      const raw: Record<string, string> = {
        mode: String(o.mode ?? ""),
        subject: String(o.subject ?? ""),
        level: String(o.level ?? ""),
        topic: String(o.topic ?? ""),
        difficulty: String(o.difficulty ?? ""),
        prompt: String(o.prompt ?? ""),
        explanation: String(o.explanation ?? ""),
        tags: Array.isArray(o.tags) ? (o.tags as string[]).join("|") : String(o.tags ?? ""),
        edition_year: String(o.edition_year ?? ""),
        correct: String(
          typeof o.correct_index === "number" ? o.correct_index + 1 : (o.correct ?? ""),
        ),
      };
      const opts = Array.isArray(o.options) ? (o.options as string[]) : [];
      raw.option_1 = String(opts[0] ?? "");
      raw.option_2 = String(opts[1] ?? "");
      raw.option_3 = String(opts[2] ?? "");
      raw.option_4 = String(opts[3] ?? "");
      const parsed = coerceRow(raw, i + 1, defaultMode, errors);
      if (parsed) rows.push(parsed);
    });
    return { rows, errors };
  }

  // CSV
  const grid = parseCSV(trimmed);
  if (grid.length < 2) { errors.push({ row: 0, field: "csv", message: "no data rows" }); return { rows, errors }; }
  const header = grid[0].map((h) => h.trim().toLowerCase());
  for (let i = 1; i < grid.length; i++) {
    const cells = grid[i];
    const raw: Record<string, string> = {};
    header.forEach((h, c) => { raw[h] = cells[c] ?? ""; });
    const parsed = coerceRow(raw, i, defaultMode, errors);
    if (parsed) rows.push(parsed);
  }
  return { rows, errors };
}

export async function importQuestions(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  if (!(await requireManage("content")))
    return { stage: "error", message: "You have read-only access to content." };
  const supabase = await createClient();

  const payload = String(formData.get("payload") ?? "");
  const defaultMode = String(formData.get("mode") ?? "practice");
  const assessmentId = String(formData.get("assessment_id") ?? "").trim() || null;
  const confirm = String(formData.get("confirm") ?? "0") === "1";

  const { rows, errors } = parsePayload(payload, defaultMode);

  // If targeting an assessment, force all rows to its pool so the trigger passes.
  let targetMode: string | null = null;
  if (assessmentId) {
    const { data: a } = await supabase.from("assessments").select("mode").eq("id", assessmentId).maybeSingle();
    targetMode = (a?.mode as string) ?? null;
    if (targetMode) rows.forEach((r) => { r.mode = targetMode as string; });
  }

  if (!confirm) {
    return { stage: "preview", parsed: rows.length + errors.length, valid: rows.length, errors };
  }
  if (rows.length === 0) {
    return { stage: "done", inserted: 0, skipped: errors.length, errors };
  }

  const { data: inserted, error } = await supabase
    .from("question_bank")
    .insert(
      rows.map((r) => ({
        mode: r.mode,
        subject: r.subject,
        level: r.level,
        topic: r.topic,
        difficulty: r.difficulty,
        prompt: r.prompt,
        options: r.options,
        correct_index: r.correct_index,
        explanation: r.explanation,
        tags: r.tags,
        edition_year: r.edition_year,
      })),
    )
    .select("id");
  if (error) return { stage: "error", message: error.message };

  if (assessmentId && inserted?.length) {
    const { count } = await supabase
      .from("assessment_questions")
      .select("id", { count: "exact", head: true })
      .eq("assessment_id", assessmentId);
    const base = count ?? 0;
    await supabase.from("assessment_questions").insert(
      inserted.map((q, i) => ({ assessment_id: assessmentId, question_id: q.id, position: base + i })),
    );
    const { data: av } = await supabase.from("assessments").select("content_version").eq("id", assessmentId).maybeSingle();
    await supabase.from("assessments").update({ content_version: ((av?.content_version as number) ?? 1) + 1 }).eq("id", assessmentId);
    revalidatePath(`/portal/admin/assessments/${assessmentId}`);
  }

  revalidatePath("/portal/admin/question-bank");
  return { stage: "done", inserted: inserted?.length ?? 0, skipped: errors.length, errors };
}

export async function deleteBankQuestion(id: string) {
  if (!(await requireManage("content"))) return;
  const supabase = await createClient();
  await supabase.from("question_bank").delete().eq("id", id);
  revalidatePath("/portal/admin/question-bank");
}
