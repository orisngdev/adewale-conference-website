import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paperKey, resultForStage, withPaperLinks, type PaperLink } from "./paper-results";

// A student row is retagged into the next edition rather than duplicated, so
// one row carries a Qualifications result for every year it competed. Both
// helpers below exist so a stage name alone can never pick the wrong year.
const RESULTS = [
  { stage: "Qualifications", edition_year: 2025, score: 38 },
  { stage: "Qualifications", edition_year: 2026, score: 71 },
  { stage: "Grand Finale Group Stage", edition_year: 2026, score: 12 },
];

describe("resultForStage", () => {
  it("picks the row for that edition, not the first stage match", () => {
    assert.equal(resultForStage(RESULTS, "Qualifications", 2026)?.score, 71);
    assert.equal(resultForStage(RESULTS, "Qualifications", 2025)?.score, 38);
  });

  it("returns nothing for an edition the rep has no row in", () => {
    assert.equal(resultForStage(RESULTS, "Qualifications", 2024), null);
  });

  // The reported bug: a 2026 rep whose paper has not been uploaded showing a
  // score, because the row carried over from 2025.
  it("does not surface a past edition's score as this year's", () => {
    const carriedOver = [{ stage: "Qualifications", edition_year: 2025, score: 38 }];
    assert.equal(resultForStage(carriedOver, "Qualifications", 2026), null);
  });
});

describe("withPaperLinks", () => {
  const links = new Map<string, PaperLink>([
    [paperKey("Qualifications", 2025), { paperId: "p25", href: "/p/25", subjects: ["Maths"] }],
    [paperKey("Qualifications", 2026), { paperId: "p26", href: "/p/26", subjects: ["Physics"] }],
  ]);

  it("links each year's result to that year's paper", () => {
    const [y25, y26] = withPaperLinks(
      [
        { stage: "Qualifications", edition_year: 2025 },
        { stage: "Qualifications", edition_year: 2026 },
      ],
      links,
    );
    assert.equal(y25.detailHref, "/p/25");
    assert.equal(y26.detailHref, "/p/26");
  });

  it("leaves a result with no paper unlinked", () => {
    const [row] = withPaperLinks([{ stage: "Finals", edition_year: 2026 }], links);
    assert.equal(row.detailHref, null);
    assert.equal(row.subjectOrder, null);
  });
});
