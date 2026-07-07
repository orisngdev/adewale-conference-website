// Offline buffer for practice results. When submit fails (no signal) the summary
// is stashed in localStorage and flushed on the next successful submit / reconnect.
// The RPC dedupes on meta.client_attempt_id, so re-flushing is safe.

import type { createClient } from "@/supabase/client";

type Db = ReturnType<typeof createClient>;

export interface PendingPractice {
  assessmentId: string;
  answers: Record<string, number>;
  meta: Record<string, unknown>;
}

const KEY = "asc.practice.pending";

export function loadPending(): PendingPractice[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as PendingPractice[];
  } catch {
    return [];
  }
}

function save(items: PendingPractice[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueuePractice(item: PendingPractice) {
  save([...loadPending(), item]);
}

export async function flushPractice(supabase: Db) {
  const all = loadPending();
  if (!all.length) return;
  const remaining: PendingPractice[] = [];
  for (const p of all) {
    const { error } = await supabase.rpc("submit_practice_attempt", {
      p_assessment_id: p.assessmentId,
      p_answers: p.answers,
      p_meta: p.meta,
    });
    if (error) remaining.push(p);
  }
  save(remaining);
}
