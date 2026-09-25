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

/** How many schools the statewide route takes, per the published rules. */
const STATEWIDE_DEFAULT = 20;

export function CutSelectionControls({ formId }: { formId: string }) {
  const [checked, setChecked] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [champions, setChampions] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [statewide, setStatewide] = useState(String(STATEWIDE_DEFAULT));

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

  function search(value: string) {
    setQuery(value);
    const needle = value.trim().toLowerCase();
    for (const row of rows()) {
      row.hidden = needle !== "" && !(row.dataset.search ?? "").includes(needle);
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

  const filtering = query.trim() !== "";
  const statewideN = Number(statewide);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search school or LGA…"
          aria-label="Search the standings by school or LGA"
          className="rounded-md border border-foreground/15 bg-card px-2.5 py-1.5 text-sm outline-none focus:border-primary"
        />
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

      <div className="flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Routes
        </span>
        <Button type="button" size="sm" variant="outline" onClick={tickChampions}>
          Tick LGA champions{champions ? ` (${champions})` : ""}
        </Button>
        <span className="flex items-center gap-1.5">
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
        </span>
        <p className="text-xs text-muted-foreground">
          Both add to what is already ticked. Divisional qualifiers stay manual — the
          schema has no LGA-to-division mapping.
        </p>
      </div>
    </div>
  );
}
