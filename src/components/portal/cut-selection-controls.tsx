"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Search, route shortcuts, and a live count for the rank-and-cut table.
// The checkboxes live in the table rows and submit into the commit form via
// `form={formId}`, so this reaches them by selector rather than lifting every
// row into client state — the table stays server-rendered and ticks survive
// everything here, because nothing re-navigates.
//
// Search HIDES rows, it never removes them: a hidden checkbox still submits, so
// a filtered table still commits the whole cohort. Filtering server-side would
// quietly mark every school you had scrolled past as not advancing.

/** What each route took in 2026, per the published rules. Both are editable —
 *  these are only the starting numbers in the boxes. */
const STATEWIDE_DEFAULT = 20;
const DIVISIONAL_DEFAULT = 4;

/** Sentinel for "nothing recorded yet" — an empty <option> value already means
 *  "no filter", so undecided needs a value of its own. */
const UNDECIDED = "\u0000undecided";

export function CutSelectionControls({ formId }: { formId: string }) {
  const [checked, setChecked] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [champions, setChampions] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [recorded, setRecorded] = useState("");
  const [recordedOptions, setRecordedOptions] = useState<string[]>([]);
  const [statewide, setStatewide] = useState(String(STATEWIDE_DEFAULT));
  const [divisional, setDivisional] = useState(String(DIVISIONAL_DEFAULT));

  function rows() {
    return [...document.querySelectorAll<HTMLTableRowElement>(`tr[data-cut-row="${formId}"]`)];
  }

  function boxOf(row: HTMLTableRowElement) {
    return row.querySelector<HTMLInputElement>('input[name="advance_ids"]');
  }

  function recount() {
    const all = rows();
    setTotal(all.length);
    setChecked(all.filter((r) => boxOf(r)?.checked).length);
    setShown(all.filter((r) => !r.hidden).length);
    setChampions(all.filter((r) => r.dataset.lgaRank === "1").length);
    // Only offer reasons that some school actually carries.
    setRecordedOptions(
      [...new Set(all.map((r) => r.dataset.recorded).filter((v): v is string => Boolean(v)))].sort(),
    );
  }

  // The rule pre-ticks the rows on the server, so the first count has to be
  // read from the DOM after mount rather than assumed.
  useEffect(() => {
    recount();
    const onChange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      if (target?.name === "advance_ids") recount();
    };
    document.addEventListener("change", onChange);
    return () => document.removeEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId]);

  /** Search text and recorded state are ANDed. Both only HIDE rows — a hidden
   *  checkbox still submits, so a filtered table still commits what it holds. */
  function applyFilters(nextQuery: string, nextRecorded: string) {
    const needle = nextQuery.trim().toLowerCase();
    for (const row of rows()) {
      const matchesText = needle === "" || (row.dataset.search ?? "").includes(needle);
      const matchesRecorded =
        nextRecorded === "" ||
        (nextRecorded === UNDECIDED
          ? !row.dataset.recorded
          : row.dataset.recorded === nextRecorded);
      row.hidden = !(matchesText && matchesRecorded);
    }
    // An LGA heading with nothing left under it is noise, so it goes too.
    for (const header of document.querySelectorAll<HTMLTableRowElement>("tr[data-lga-header]")) {
      const lga = header.dataset.lgaHeader;
      header.hidden = !rows().some((r) => r.dataset.lga === lga && !r.hidden);
    }
    recount();
  }

  /** Applies to the rows currently shown, so searching an LGA and hitting
   *  "Select shown" ticks that LGA rather than the whole state. */
  function apply(next: (box: HTMLInputElement) => boolean) {
    for (const row of rows()) {
      if (row.hidden) continue;
      const box = boxOf(row);
      if (box) box.checked = next(box);
    }
    recount();
  }

  /** Route One: the top school in every LGA. Adds to the selection rather than
   *  replacing it, so it composes with the statewide pass. */
  function tickChampions() {
    for (const row of rows()) {
      if (row.dataset.lgaRank !== "1") continue;
      const box = boxOf(row);
      if (box) box.checked = true;
    }
    recount();
  }

  /** Route Two: the highest-scoring schools NOT already taken by another route.
   *  Walks statewide rank order and stops once `n` more are ticked. */
  function tickStatewide(n: number) {
    const remaining = rows()
      .filter((r) => !boxOf(r)?.checked)
      .sort((a, b) => Number(a.dataset.rank ?? 0) - Number(b.dataset.rank ?? 0));
    for (const row of remaining.slice(0, Math.max(0, n))) {
      const box = boxOf(row);
      if (box) box.checked = true;
    }
    recount();
  }

  /** Route Three: the strongest `n` schools left in each division. A row whose
   *  LGA did not resolve to a division is skipped rather than guessed at — it
   *  must not take a place from a school that genuinely belongs there. */
  function tickDivisional(n: number) {
    const byDivision = new Map<string, HTMLTableRowElement[]>();
    for (const row of rows()) {
      const division = row.dataset.division;
      if (!division || boxOf(row)?.checked) continue;
      const list = byDivision.get(division) ?? [];
      list.push(row);
      byDivision.set(division, list);
    }
    for (const list of byDivision.values()) {
      const ordered = list.sort(
        (a, b) => Number(a.dataset.rank ?? 0) - Number(b.dataset.rank ?? 0),
      );
      for (const row of ordered.slice(0, Math.max(0, n))) {
        const box = boxOf(row);
        if (box) box.checked = true;
      }
    }
    recount();
  }

  const filtering = query.trim() !== "" || recorded !== "";
  const statewideN = Number(statewide);
  const divisionalN = Number(divisional);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            applyFilters(e.target.value, recorded);
          }}
          placeholder="Search school or LGA…"
          aria-label="Search the standings by school or LGA"
          className="rounded-md border border-foreground/15 bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
        <select
          value={recorded}
          onChange={(e) => {
            setRecorded(e.target.value);
            applyFilters(query, e.target.value);
          }}
          aria-label="Filter by what is already recorded"
          className="rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
        >
          <option value="">Any recorded state</option>
          {recordedOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={UNDECIDED}>Not yet decided</option>
        </select>
        <Button type="button" size="sm" variant="outline" onClick={() => apply(() => true)}>
          {filtering ? "Select shown" : "Select all"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => apply(() => false)}>
          Clear
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => apply((b) => !b.checked)}>
          Invert
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {checked === null || total === null
            ? "Counting…"
            : `${checked} of ${total} ticked to advance`}
          {filtering && shown !== null ? ` · showing ${shown}` : ""}
        </p>
      </div>

      {/* Each control is captioned with the route it fills, because "Tick next
          20 by score" does not say WHY you would, and the operator is working
          from published rules that name these three routes. */}
      <div className="border-t border-foreground/10 pt-3">
        <div className="flex flex-wrap items-start gap-x-5 gap-y-3">
          <Route caption="Route one · LGA champions">
            <Button type="button" size="sm" variant="outline" onClick={tickChampions}>
              Tick LGA champions{champions ? ` (${champions})` : ""}
            </Button>
          </Route>

          <Route caption="Route two · Statewide qualifiers">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => tickStatewide(Number.isFinite(statewideN) ? statewideN : 0)}
            >
              Tick next
            </Button>
            <input
              type="number"
              min={1}
              value={statewide}
              onChange={(e) => setStatewide(e.target.value)}
              aria-label="How many statewide qualifiers to add"
              className="w-16 rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">by score</span>
          </Route>

          <Route caption="Route three · Divisional qualifiers">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => tickDivisional(Number.isFinite(divisionalN) ? divisionalN : 0)}
            >
              Tick top
            </Button>
            <input
              type="number"
              min={1}
              value={divisional}
              onChange={(e) => setDivisional(e.target.value)}
              aria-label="How many schools to take from each division"
              className="w-16 rounded-md border border-foreground/15 bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
            <span className="text-sm text-muted-foreground">per division</span>
          </Route>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Each route adds to what is already ticked, so run them in order: champions,
          then statewide, then divisional.
        </p>
      </div>
    </div>
  );
}

/** One route control with the route it fills named underneath it. */
function Route({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5">{children}</div>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}
