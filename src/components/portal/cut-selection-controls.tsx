"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

// Search, select-all/clear/invert, and a live count for the rank-and-cut table.
// The checkboxes live in the table rows and submit into the commit form via
// `form={formId}`, so this reaches them by selector rather than lifting every
// row into client state — the table stays server-rendered.
//
// Search HIDES rows, it never removes them: a hidden checkbox still submits, so
// a filtered table still commits the whole cohort. Filtering server-side would
// quietly mark every school you had scrolled past as not advancing.
export function CutSelectionControls({ formId }: { formId: string }) {
  const [checked, setChecked] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [shown, setShown] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  function boxes() {
    return [
      ...document.querySelectorAll<HTMLInputElement>(
        `input[type="checkbox"][name="advance_ids"][form="${formId}"]`,
      ),
    ];
  }

  function rows() {
    return [...document.querySelectorAll<HTMLTableRowElement>(`tr[data-cut-row="${formId}"]`)];
  }

  function recount() {
    const all = boxes();
    setTotal(all.length);
    setChecked(all.filter((box) => box.checked).length);
    setShown(rows().filter((row) => !row.hidden).length);
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
    recount();
  }

  // Applies to the rows currently shown, so searching an LGA and hitting
  // "Select all" ticks that LGA rather than the whole state.
  function apply(next: (box: HTMLInputElement) => boolean) {
    for (const row of rows()) {
      if (row.hidden) continue;
      const box = row.querySelector<HTMLInputElement>('input[name="advance_ids"]');
      if (box) box.checked = next(box);
    }
    recount();
  }

  const filtering = query.trim() !== "";

  return (
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
  );
}
