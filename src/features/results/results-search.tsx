"use client";

import { useState } from "react";

// Find-my-school for the Hall of Fame. The page is server-rendered so every
// school is in the HTML for search engines and for readers with no JavaScript;
// this only HIDES what does not match, and unhides it again when the box is
// cleared. Nothing is fetched and nothing re-navigates.
//
// Matching runs over the school name, its LGA and its reps' names, so a parent
// can type their child's name and find the school that way.
export function ResultsSearch({ total }: { total: number }) {
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(total);

  function search(value: string) {
    setQuery(value);
    const needle = value.trim().toLowerCase();

    const cards = [...document.querySelectorAll<HTMLElement>("[data-school-card]")];
    for (const card of cards) {
      card.hidden = needle !== "" && !(card.dataset.schoolCard ?? "").includes(needle);
    }
    // Bottom-up: an LGA heading, a stage section or a whole edition with nothing
    // visible left under it is noise.
    for (const selector of ["[data-lga-group]", "[data-stage-block]", "[data-edition-block]"]) {
      for (const box of document.querySelectorAll<HTMLElement>(selector)) {
        box.hidden = !box.querySelector("[data-school-card]:not([hidden])");
      }
    }
    setShown(cards.filter((c) => !c.hidden).length);
  }

  return (
    <div className="mb-8">
      <label className="block">
        <span className="sr-only">Search for a school, an LGA or a student</span>
        <input
          type="search"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Find a school, an LGA or a student…"
          className="w-full max-w-md border border-[rgba(10,15,30,0.15)] bg-white px-4 py-3 text-base outline-none focus:border-[#0A0F1E]"
        />
      </label>
      <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
        {query.trim() === ""
          ? `${total} school${total === 1 ? "" : "s"} listed`
          : shown === 0
            ? "Nothing matches that search."
            : `${shown} of ${total} school${total === 1 ? "" : "s"}`}
      </p>
    </div>
  );
}
