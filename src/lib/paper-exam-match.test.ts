import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  matchPaper,
  matchPapers,
  normalizePersonName,
  personNameKey,
  type RosterCandidate,
} from "./paper-exam-match";
import type { RawPaper } from "./zipgrade";

const paper = (over: Partial<RawPaper> = {}): RawPaper => ({
  rowIndex: 1,
  externalId: null,
  examNo: null,
  firstName: null,
  lastName: null,
  className: null,
  customId: null,
  keyVersion: null,
  responses: [],
  captureNumCorrect: null,
  capturedKey: null,
  raw: {},
  ...over,
});

const ADA: RosterCandidate = {
  studentId: "11111111-1111-1111-1111-111111111111",
  name: "Ada Bright",
  schoolId: "s1",
  schoolName: "Bright Academy",
  examNo: "001",
  className: "SS1",
  level: "SS1",
};
const BEN: RosterCandidate = {
  studentId: "22222222-2222-2222-2222-222222222222",
  name: "Ben Bright",
  schoolId: "s1",
  schoolName: "Bright Academy",
  examNo: "002",
  className: "SS1",
  level: "SS1",
};
const MUSA: RosterCandidate = {
  studentId: "33333333-3333-3333-3333-333333333333",
  name: "Musa Unity",
  schoolId: "s2",
  schoolName: "Unity College",
  examNo: "003",
  className: "SS2",
  level: "SS2",
};
const ROSTER = [ADA, BEN, MUSA];

describe("normalizePersonName", () => {
  it("folds case, punctuation and whitespace", () => {
    assert.equal(normalizePersonName("  ADA-BRIGHT,  jr. "), "ada bright jr");
  });

  it("folds diacritics so Adéwálé matches Adewale", () => {
    assert.equal(normalizePersonName("Adéwálé"), "adewale");
  });

  it("survives an empty name", () => {
    assert.equal(normalizePersonName(""), "");
  });
});

describe("personNameKey", () => {
  it("is order-insensitive, so SURNAME First matches First SURNAME", () => {
    assert.equal(personNameKey("BRIGHT ADA"), personNameKey("Ada Bright"));
  });

  it("still separates different names", () => {
    assert.notEqual(personNameKey("Ada Bright"), personNameKey("Ben Bright"));
  });
});

describe("matchPaper", () => {
  it("matches on External ID exactly", () => {
    const r = matchPaper(paper({ externalId: ADA.studentId }), ROSTER);
    assert.equal(r.studentId, ADA.studentId);
    assert.equal(r.method, "external_id");
    assert.equal(r.confidence, "exact");
  });

  it("matches an External ID with the hyphens stripped", () => {
    const r = matchPaper(paper({ externalId: ADA.studentId.replace(/-/g, "") }), ROSTER);
    assert.equal(r.studentId, ADA.studentId);
  });

  it("prefers External ID over a candidate number that points elsewhere", () => {
    // A mis-bubbled digit must not beat the ID we printed ourselves.
    const r = matchPaper(paper({ externalId: ADA.studentId, examNo: "003" }), ROSTER);
    assert.equal(r.studentId, ADA.studentId);
    assert.equal(r.method, "external_id");
  });

  it("falls back to the candidate number when the External ID is missing", () => {
    const r = matchPaper(paper({ examNo: "002" }), ROSTER);
    assert.equal(r.studentId, BEN.studentId);
    assert.equal(r.method, "exam_no");
    assert.equal(r.confidence, "exact");
  });

  it("compares candidate numbers numerically, so 007 equals 7", () => {
    const roster = [{ ...ADA, examNo: "7" }];
    assert.equal(matchPaper(paper({ examNo: "007" }), roster).studentId, ADA.studentId);
    const roster2 = [{ ...ADA, examNo: "007" }];
    assert.equal(matchPaper(paper({ examNo: "7" }), roster2).studentId, ADA.studentId);
  });

  it("matches on name when there is no id at all", () => {
    const r = matchPaper(paper({ firstName: "Ada", lastName: "Bright" }), ROSTER);
    assert.equal(r.studentId, ADA.studentId);
    assert.equal(r.method, "name_class");
    assert.equal(r.confidence, "probable");
  });

  it("matches a name given in the other order", () => {
    const r = matchPaper(paper({ firstName: "Bright", lastName: "Ada" }), ROSTER);
    assert.equal(r.studentId, ADA.studentId);
  });

  // The case that must never be guessed.
  it("is ambiguous when the same name exists at two schools", () => {
    const twin: RosterCandidate = { ...MUSA, studentId: "44444444-4444-4444-4444-444444444444", name: "Ada Bright" };
    const r = matchPaper(paper({ firstName: "Ada", lastName: "Bright" }), [ADA, twin]);
    assert.equal(r.studentId, null);
    assert.equal(r.confidence, "ambiguous");
    assert.equal(r.suggestions.length, 2, "both candidates must be offered");
  });

  it("resolves a duplicate name when the sheet's Class separates them", () => {
    // Same name, different year: ADA is SS1, the twin is SS2.
    const twin: RosterCandidate = { ...MUSA, studentId: "44444444-4444-4444-4444-444444444444", name: "Ada Bright" };
    const r = matchPaper(
      paper({ firstName: "Ada", lastName: "Bright", className: "SS2" }),
      [ADA, twin],
    );
    assert.equal(r.studentId, twin.studentId);
    assert.equal(r.confidence, "probable");
  });

  it("reads SS 2 and ss2 as the same class", () => {
    const twin: RosterCandidate = { ...MUSA, studentId: "44444444-4444-4444-4444-444444444444", name: "Ada Bright" };
    for (const written of ["ss2", "SS 2", " SS2 "]) {
      const r = matchPaper(
        paper({ firstName: "Ada", lastName: "Bright", className: written }),
        [ADA, twin],
      );
      assert.equal(r.studentId, twin.studentId, `class written as "${written}"`);
    }
  });

  // A file exported before Class meant "the rep's class" carried a centre or
  // school name; that must still narrow rather than silently match nothing.
  it("still narrows on a school name in the Class field (older files)", () => {
    const twin: RosterCandidate = { ...MUSA, studentId: "44444444-4444-4444-4444-444444444444", name: "Ada Bright" };
    const r = matchPaper(
      paper({ firstName: "Ada", lastName: "Bright", className: "Unity College" }),
      [ADA, twin],
    );
    assert.equal(r.studentId, twin.studentId);
  });

  // The real export carries the school in CustomID, which is what separates two
  // students who share a name and a class at different centres.
  it("separates same-name, same-class students on the school in Custom ID", () => {
    const twin: RosterCandidate = {
      ...MUSA,
      studentId: "44444444-4444-4444-4444-444444444444",
      name: "Ada Bright",
      className: "SS1",
      level: "SS1",
    };
    const both = [ADA, twin];
    const ambiguous = matchPaper(
      paper({ firstName: "Ada", lastName: "Bright", className: "SS1" }),
      both,
    );
    assert.equal(ambiguous.confidence, "ambiguous", "the class alone cannot separate them");

    const r = matchPaper(
      paper({ firstName: "Ada", lastName: "Bright", className: "SS1", customId: "Unity College" }),
      both,
    );
    assert.equal(r.studentId, twin.studentId);
    assert.equal(r.confidence, "probable");
  });

  // A number is only as good as the hand that bubbled it. This is also what
  // catches a file from the wrong sitting whose IDs happen to overlap ours.
  it("keeps a number match but flags it when the sheet names someone else", () => {
    const r = matchPaper(
      paper({ examNo: "001", firstName: "Sam", lastName: "Rivers" }),
      ROSTER,
    );
    assert.equal(r.studentId, ADA.studentId, "the bubbled number is still the identity");
    assert.equal(r.nameMismatch, true);
    assert.equal(r.confidence, "probable", "no longer exact");
    assert.match(r.suggestions[0].why, /the sheet is named/);
  });

  it("does not flag a number match when the names agree", () => {
    const r = matchPaper(paper({ examNo: "001", firstName: "Ada", lastName: "Bright" }), ROSTER);
    assert.equal(r.confidence, "exact");
    assert.ok(!r.nameMismatch);
  });

  it("does not flag a number match when the sheet carries no name", () => {
    const r = matchPaper(paper({ examNo: "001" }), ROSTER);
    assert.equal(r.confidence, "exact");
    assert.ok(!r.nameMismatch);
  });

  // The tool calls one free-text field "External ID" on its paper reports and
  // "CustomID" in its export. The 2025 sitting put the SCHOOL in it, so a value
  // that is not UUID-shaped must never be matched against student ids.
  it("does not treat a school name in External ID as a record id", () => {
    const r = matchPaper(
      paper({
        externalId: "UNITY COLLEGE, RIVERSIDE",
        firstName: "Ada",
        lastName: "Bright",
      }),
      ROSTER,
    );
    assert.equal(r.studentId, ADA.studentId);
    assert.equal(r.method, "name_class", "matched on the name, not on the id rung");
  });

  it("uses a non-UUID External ID as a school hint", () => {
    const twin: RosterCandidate = {
      ...MUSA,
      studentId: "44444444-4444-4444-4444-444444444444",
      name: "Ada Bright",
      className: "SS1",
      level: "SS1",
    };
    const r = matchPaper(
      paper({ externalId: "Unity College", firstName: "Ada", lastName: "Bright" }),
      [ADA, twin],
    );
    assert.equal(r.studentId, twin.studentId);
  });

  it("still matches on a real record id", () => {
    const r = matchPaper(paper({ externalId: ADA.studentId }), ROSTER);
    assert.equal(r.studentId, ADA.studentId);
    assert.equal(r.method, "external_id");
    assert.equal(r.confidence, "exact");
  });

  it("is ambiguous when two roster rows share a candidate number", () => {

    const clash = [{ ...ADA }, { ...BEN, examNo: "001" }];
    const r = matchPaper(paper({ examNo: "001" }), clash);
    assert.equal(r.confidence, "ambiguous");
    assert.match(r.suggestions[0].why, /shares candidate number 001/);
  });

  it("returns none plus the nearest candidates when nothing matches", () => {
    const r = matchPaper(paper({ firstName: "Ada", lastName: "Nomatch" }), ROSTER);
    assert.equal(r.studentId, null);
    assert.equal(r.confidence, "none");
    assert.equal(r.suggestions[0].studentId, ADA.studentId, "shares the token 'ada'");
    assert.match(r.suggestions[0].why, /part of the name matched/);
  });

  it("returns none with no suggestions for a wholly blank sheet", () => {
    const r = matchPaper(paper({ examNo: "999" }), ROSTER);
    assert.equal(r.confidence, "none");
    assert.deepEqual(r.suggestions, []);
  });

  it("explains whether the class or school agreed in each suggestion", () => {
    const r = matchPaper(
      paper({ firstName: "Ada", lastName: "Nomatch", className: "SS1" }),
      ROSTER,
    );
    assert.match(r.suggestions[0].why, /the class or school agreed/);
  });
});

describe("matchPapers", () => {
  it("summarises what needs a decision", () => {
    const { summary } = matchPapers(
      [
        paper({ rowIndex: 1, externalId: ADA.studentId }),
        paper({ rowIndex: 2, firstName: "Nobody", lastName: "Here" }),
        paper({ rowIndex: 3, examNo: "003" }),
      ],
      ROSTER,
    );
    assert.equal(summary.total, 3);
    assert.equal(summary.matched, 2);
    assert.equal(summary.unmatched, 1);
    assert.equal(summary.undecided, 1);
  });

  // Two sheets for one student cannot both be kept, and which one survives is
  // a human decision — the database enforces this too, via a partial unique
  // index, but catching it here keeps the commit from failing mid-batch.
  it("demotes BOTH sheets to ambiguous when two match the same student", () => {
    const { results, summary } = matchPapers(
      [
        paper({ rowIndex: 1, externalId: ADA.studentId }),
        paper({ rowIndex: 2, examNo: "001" }),
      ],
      ROSTER,
    );
    assert.equal(summary.matched, 0);
    assert.equal(summary.ambiguous, 2);
    assert.equal(summary.undecided, 2);
    for (const r of results) {
      assert.equal(r.match.studentId, null);
      assert.match(r.match.suggestions[0].why, /another sheet in this file/);
    }
  });

  it("leaves distinct students alone", () => {
    const { summary } = matchPapers(
      [
        paper({ rowIndex: 1, externalId: ADA.studentId }),
        paper({ rowIndex: 2, externalId: BEN.studentId }),
      ],
      ROSTER,
    );
    assert.equal(summary.matched, 2);
    assert.equal(summary.undecided, 0);
  });

  it("handles an empty file", () => {
    const { results, summary } = matchPapers([], ROSTER);
    assert.deepEqual(results, []);
    assert.equal(summary.total, 0);
    assert.equal(summary.undecided, 0);
  });
});
