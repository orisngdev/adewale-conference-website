# 0002 — Disjoint practice/exam question pools with one-way promotion

Each question in the bank is tagged `mode` (practice or exam) and can serve only that mode. Practice answers ship to devices for offline instant marking; **exam answers never leave the server**. A `mode`-scoped `SECURITY DEFINER` RPC (`get_practice_bank`) is the *only* path that emits `correct_index`, and a `BEFORE INSERT` trigger on `assessment_questions` rejects any question whose `mode` differs from the assessment's — so a live exam answer cannot leak through the practice path even by mistake. Retired exam questions can be **promoted** (copied) into the practice pool.

## Considered options
- **Disjoint pools + mode-scoped RPC + trigger (chosen).** The safety guarantee is structural, enforced in SQL, not in application code.
- **One shared pool feeding both.** Simpler authoring, but any question used in a live exam would leak its answer to phones through practice.
