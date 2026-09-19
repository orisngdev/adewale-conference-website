import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isDerivedSeriesHeader,
  normalizeHeaderKey,
  readCapturedKey,
  paperFingerprint,
  parseAnswer,
  readPapers,
  readQuizName,
  sniffZipGradeHeader,
  splitName,
  zipgradeRosterMatrix,
} from "./zipgrade";

const ok = (r: ReturnType<typeof sniffZipGradeHeader>) => {
  assert.equal(r.ok, true, r.ok ? "" : `sniff failed: ${r.error}`);
  if (!r.ok) throw new Error("unreachable");
  return r.map;
};

describe("normalizeHeaderKey", () => {
  it("collapses every spelling of the same column", () => {
    for (const h of ["External Id", "external_id", "ExternalID", " EXTERNAL-ID "]) {
      assert.equal(normalizeHeaderKey(h), "externalid");
    }
  });

  it("strips a BOM off the first header", () => {
    assert.equal(normalizeHeaderKey("﻿Quiz Name"), "quizname");
  });
});

describe("sniffZipGradeHeader", () => {
  const header = (n: number, prefix = "Stu") => [
    "Quiz Name",
    "First Name",
    "Last Name",
    "Student ID",
    "External Id",
    "Class",
    "Num Correct",
    ...Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`),
  ];

  it("maps the named columns however they are spelled", () => {
    const map = ok(sniffZipGradeHeader(header(10), 10));
    assert.equal(map.fields.quizName, 0);
    assert.equal(map.fields.firstName, 1);
    assert.equal(map.fields.lastName, 2);
    assert.equal(map.fields.examNo, 3);
    assert.equal(map.fields.externalId, 4);
    assert.equal(map.fields.className, 5);
    assert.equal(map.fields.captureNumCorrect, 6);
  });

  it("finds the response series by pattern, not by offset", () => {
    const map = ok(sniffZipGradeHeader(header(10), 10));
    assert.deepEqual(map.responseColumns, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it("accepts any series prefix", () => {
    for (const prefix of ["Stu", "Q", "Question ", "Answer", "Resp"]) {
      const map = ok(sniffZipGradeHeader(header(10, prefix), 10));
      assert.equal(map.responseColumns.length, 10, `prefix ${prefix}`);
    }
  });

  it("separates a key series from a response series by prefix keyword", () => {
    const headers = [
      "External Id",
      ...Array.from({ length: 10 }, (_, i) => `Stu${i + 1}`),
      ...Array.from({ length: 10 }, (_, i) => `Key${i + 1}`),
    ];
    const map = ok(sniffZipGradeHeader(headers, 10));
    assert.deepEqual(map.responseColumns[0], 1, "Stu1 is the first response column");
    assert.equal(map.keyColumns?.[0], 11, "Key1 is the first key column");
  });

  // When both series have neutral names, only the DATA can tell them apart:
  // responses differ between students, a key is identical on every row.
  it("falls back to the data when both series have neutral names", () => {
    const headers = [
      "External Id",
      ...Array.from({ length: 6 }, (_, i) => `a${i + 1}`),
      ...Array.from({ length: 6 }, (_, i) => `b${i + 1}`),
    ];
    const samples = [
      ["x1", "A", "B", "C", "D", "A", "B", "A", "A", "A", "A", "A", "A"],
      ["x2", "D", "D", "D", "D", "D", "D", "A", "A", "A", "A", "A", "A"],
    ];
    const map = ok(sniffZipGradeHeader(headers, 6, samples));
    assert.equal(map.responseColumns[0], 1, "the varying series is the responses");
    assert.equal(map.keyColumns?.[0], 7, "the constant series is the key");
  });

  it("refuses a file with no per-question series, naming the headers seen", () => {
    const r = sniffZipGradeHeader(["Quiz Name", "First Name", "Num Correct"], 10);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /Full Format/);
    assert.deepEqual(r.headers, ["Quiz Name", "First Name", "Num Correct"]);
  });

  it("refuses a series shorter than the exam, and says how long it was", () => {
    const r = sniffZipGradeHeader(header(8), 10);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /1–8/);
    assert.match(r.error, /10 items/);
  });

  it("ignores extra response columns beyond the item count, with a warning", () => {
    const map = ok(sniffZipGradeHeader(header(100), 10));
    assert.equal(map.responseColumns.length, 10);
    assert.match(map.warnings.join(" "), /only items 1–10 are scored/);
  });

  it("does not let a stray numbered column become the series", () => {
    const r = sniffZipGradeHeader(["External Id", "col7"], 10);
    assert.equal(r.ok, false);
  });

  it("warns when there is no identity column at all", () => {
    const headers = ["Quiz Name", ...Array.from({ length: 10 }, (_, i) => `Stu${i + 1}`)];
    const map = ok(sniffZipGradeHeader(headers, 10));
    assert.match(map.warnings.join(" "), /matched by name/);
  });

  it("reports genuinely unrecognised columns instead of guessing", () => {
    const map = ok(sniffZipGradeHeader([...header(10), "Teacher Notes"], 10));
    assert.deepEqual(map.unmapped, ["Teacher Notes"]);
  });
});

describe("parseAnswer", () => {
  it("reads a letter", () => {
    assert.equal(parseAnswer("A"), "A");
    assert.equal(parseAnswer(" c "), "C");
    assert.equal(parseAnswer("b."), "B");
  });

  it("reads a 1-5 index as a letter", () => {
    assert.equal(parseAnswer("1"), "A");
    assert.equal(parseAnswer("4"), "D");
    assert.equal(parseAnswer("5", 5), "E");
  });

  // The 2025 Zonal Finals key has an E at item 20 and students shading it.
  it("reads E as a real option on a five-option sheet", () => {
    assert.equal(parseAnswer("E", 5), "E");
    assert.equal(parseAnswer(" e ", 5), "E");
    assert.equal(parseAnswer("5", 5), "E");
  });

  // A bubble the sheet does not have cannot be an answer; treating it as one
  // would score a misread instead of flagging it.
  it("reads a letter past the sheet's options as an unreadable mark", () => {
    assert.equal(parseAnswer("E", 4), "?");
    assert.equal(parseAnswer("5", 4), "?");
    assert.equal(parseAnswer("D", 4), "D");
  });

  it("assumes four options when none is given", () => {
    assert.equal(parseAnswer("E"), "?");
    assert.equal(parseAnswer("D"), "D");
  });

  it("reads a blank as null", () => {
    assert.equal(parseAnswer(""), null);
    assert.equal(parseAnswer("   "), null);
    assert.equal(parseAnswer("-"), null);
    assert.equal(parseAnswer(undefined), null);
    assert.equal(parseAnswer(null), null);
  });

  it("reads a double-bubble or junk as an invalid mark, not as blank", () => {
    assert.equal(parseAnswer("*"), "?");
    assert.equal(parseAnswer("AB"), "?");
    assert.equal(parseAnswer("CE"), "?");
    assert.equal(parseAnswer("9"), "?");
  });
});

describe("splitName", () => {
  it("treats the last token as the surname", () => {
    assert.deepEqual(splitName("Ada Chidi Bright"), { first: "Ada Chidi", last: "Bright" });
  });

  it("handles SURNAME, First", () => {
    assert.deepEqual(splitName("BRIGHT, ADA"), { first: "ADA", last: "BRIGHT" });
  });

  it("gives a single-token name a placeholder surname", () => {
    // The capture tool's roster import requires both fields.
    assert.deepEqual(splitName("Musa"), { first: "Musa", last: "-" });
  });

  it("collapses stray whitespace", () => {
    assert.deepEqual(splitName("  Ada   Bright  "), { first: "Ada", last: "Bright" });
  });

  it("survives an empty name", () => {
    assert.deepEqual(splitName(""), { first: "", last: "-" });
  });
});

describe("readPapers", () => {
  const grid = [
    ["Quiz Name", "First Name", "Last Name", "Student ID", "External Id", "Class", "Num Correct", "Key", "Stu1", "Stu2", "Stu3"],
    ["ASC 2026", "Ada", "Bright", "001", "uuid-ada", "Lagos", "2", "A", "A", "B", ""],
    ["ASC 2026", "Ben", "Bright", "002", "uuid-ben", "Lagos", "1", "B", "A", "*", "C"],
  ];
  const map = ok(sniffZipGradeHeader(grid[0], 3));

  it("reads identity, responses and the tool's own total", () => {
    const papers = readPapers(grid, map, 3);
    assert.equal(papers.length, 2);
    assert.equal(papers[0].externalId, "uuid-ada");
    assert.equal(papers[0].examNo, "001");
    assert.equal(papers[0].firstName, "Ada");
    assert.equal(papers[0].lastName, "Bright");
    assert.equal(papers[0].className, "Lagos");
    assert.equal(papers[0].captureNumCorrect, 2);
    assert.deepEqual(papers[0].responses, ["A", "B", null]);
  });

  it("numbers rows from 1 so a finding traces back to the file", () => {
    const papers = readPapers(grid, map, 3);
    assert.equal(papers[0].rowIndex, 1);
    assert.equal(papers[1].rowIndex, 2);
  });

  it("reads the key version and keeps a double-bubble as '?'", () => {
    const papers = readPapers(grid, map, 3);
    assert.equal(papers[1].keyVersion, "B");
    assert.deepEqual(papers[1].responses, ["A", "?", "C"]);
  });

  it("keeps the whole source row verbatim so nothing is lost", () => {
    const papers = readPapers(grid, map, 3);
    assert.equal(papers[0].raw["External Id"], "uuid-ada");
    assert.equal(papers[0].raw["Quiz Name"], "ASC 2026");
  });

  it("splits a single Name column when First/Last are absent", () => {
    const g = [
      ["Name", "External Id", "Stu1", "Stu2", "Stu3"],
      ["Ada Bright", "uuid-ada", "A", "B", "C"],
    ];
    const m = ok(sniffZipGradeHeader(g[0], 3));
    const papers = readPapers(g, m, 3);
    assert.equal(papers[0].firstName, "Ada");
    assert.equal(papers[0].lastName, "Bright");
  });

  it("ignores a non-numeric Num Correct rather than importing NaN", () => {
    const g = [
      ["External Id", "Num Correct", "Stu1", "Stu2", "Stu3"],
      ["u1", "n/a", "A", "B", "C"],
    ];
    const m = ok(sniffZipGradeHeader(g[0], 3));
    assert.equal(readPapers(g, m, 3)[0].captureNumCorrect, null);
  });

  it("reads the quiz name for the wrong-export check", () => {
    assert.equal(readQuizName(grid, map), "ASC 2026");
  });
});

describe("paperFingerprint", () => {
  const base = {
    externalId: "u1",
    examNo: "001",
    firstName: "Ada",
    lastName: "Bright",
    responses: ["A", "B", null] as const,
  };

  it("is stable for the same sheet, so a re-import is a no-op", () => {
    assert.equal(paperFingerprint("exam1", { ...base }), paperFingerprint("exam1", { ...base }));
  });

  it("differs when the marks differ, so a second sheet still lands", () => {
    assert.notEqual(
      paperFingerprint("exam1", base),
      paperFingerprint("exam1", { ...base, responses: ["A", "B", "C"] }),
    );
  });

  it("is scoped to the exam", () => {
    assert.notEqual(paperFingerprint("exam1", base), paperFingerprint("exam2", base));
  });

  it("ignores name casing but not identity", () => {
    assert.equal(
      paperFingerprint("e", { ...base, firstName: "ADA", lastName: "BRIGHT" }),
      paperFingerprint("e", base),
    );
    assert.notEqual(paperFingerprint("e", { ...base, examNo: "002" }), paperFingerprint("e", base));
  });
});

describe("zipgradeRosterMatrix", () => {
  const rows = [
    {
      examNo: "001",
      name: "Ada Bright",
      className: "SS1",
      schoolName: "Bright Academy",
      teacherName: "Mrs Okoro",
    },
    { examNo: "2", name: "Musa", className: null, schoolName: null, teacherName: null },
  ];

  it("puts the school in Custom ID, the one field the tool round-trips", () => {
    assert.deepEqual(zipgradeRosterMatrix(rows)[0], [
      "First Name",
      "Last Name",
      "Student ID",
      "Class",
      "Custom ID",
      "Teacher",
    ]);
  });

  it("carries no External ID and no identifier beyond the candidate number", () => {
    const matrix = zipgradeRosterMatrix(rows);
    assert.ok(!matrix[0].includes("External ID"));
    const flat = JSON.stringify(matrix);
    // Neither a record id nor an access code may reach a third party's cloud.
    assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}/.test(flat), "no UUID in the roster");
    assert.ok(!flat.includes("AAA"), "no access code in the roster");
  });

  it("pads the candidate number to the 3 digits the bubble box holds", () => {
    assert.equal(zipgradeRosterMatrix(rows)[1][2], "001");
    assert.equal(zipgradeRosterMatrix(rows)[2][2], "002");
  });

  it("carries the student's class, school and teacher", () => {
    assert.deepEqual(zipgradeRosterMatrix(rows)[1], [
      "Ada",
      "Bright",
      "001",
      "SS1",
      "Bright Academy",
      "Mrs Okoro",
    ]);
  });

  it("splits names and leaves missing fields empty rather than absent", () => {
    assert.deepEqual(zipgradeRosterMatrix(rows)[2], ["Musa", "-", "002", "", "", ""]);
  });
});

// ── the real thing ──────────────────────────────────────────────────────────
// Built from quiz-ASC 2025 Zonal Finals-full.csv verbatim: four interleaved
// 100-long series at stride 4, `Key Version` blank on every row, the school in
// CustomID, and an E in the key at item 20.
describe("the real ZipGrade export", () => {
  const N = 100;
  const header = [
    "QuizName",
    "QuizClass",
    "FirstName",
    "LastName",
    "StudentID",
    "CustomID",
    "Earned Points",
    "Possible Points",
    "PercentCorrect",
    "QuizCreated",
    "DataExported",
    "Key Version",
    ...Array.from({ length: N }, (_, i) => [
      `Stu${i + 1}`,
      `PriKey${i + 1}`,
      `Points${i + 1}`,
      `Mark${i + 1}`,
    ]).flat(),
  ];

  // Item 20's answer is E; every other answer is B, so a series mix-up shows up
  // as a wrong score rather than as a coincidence.
  const key = Array.from({ length: N }, (_, i) => (i === 19 ? "E" : "B"));
  const row = (name: [string, string], id: string, answers: string[]) => [
    "ASC 2025 Zonal Finals",
    "SS2",
    name[0],
    name[1],
    id,
    "BRIGHT ACADEMY",
    String(answers.filter((a, i) => a === key[i]).length),
    String(N),
    "",
    "2025-06-01",
    "2025-06-02",
    "", // Key Version is blank on every row of the real file.
    ...answers
      .map((a, i) => [a, key[i], a === key[i] ? "1" : "0", a === key[i] ? "C" : "X"])
      .flat(),
  ];

  const answersA = Array.from({ length: N }, (_, i) => (i === 19 ? "E" : "B"));
  const answersB = Array.from({ length: N }, (_, i) => (i === 19 ? "C" : "B"));
  const grid = [
    header,
    row(["ADA", "BRIGHT"], "25", answersA),
    row(["BEN", "BRIGHT"], "26", answersB),
  ];
  const map = ok(sniffZipGradeHeader(header, N, grid.slice(1)));

  it("reads the student's answers, not the tool's Points or Mark columns", () => {
    // Stu1 is column 12, and the stride is 4.
    assert.deepEqual(map.responseColumns.slice(0, 3), [12, 16, 20]);
    assert.deepEqual(map.keyColumns?.slice(0, 3), [13, 17, 21]);
  });

  it("maps the named columns of the real header", () => {
    assert.equal(map.fields.quizName, 0);
    assert.equal(map.fields.className, 1);
    assert.equal(map.fields.firstName, 2);
    assert.equal(map.fields.lastName, 3);
    assert.equal(map.fields.examNo, 4);
    assert.equal(map.fields.customId, 5);
    assert.equal(map.fields.captureNumCorrect, 6);
    assert.equal(map.fields.possiblePoints, 7);
    assert.equal(map.fields.keyVersion, 11);
  });

  it("counts the 200 scoring columns instead of listing them as unread", () => {
    assert.deepEqual(map.unmapped, []);
    assert.match(map.warnings.join(" "), /Ignored 200 per-question scoring columns/);
  });

  it("carries the school through CustomID for name matching", () => {
    assert.equal(readPapers(grid, map, N)[0].customId, "BRIGHT ACADEMY");
  });

  it("leaves the key version null, since the real file never fills it", () => {
    assert.equal(readPapers(grid, map, N)[0].keyVersion, null);
  });

  it("reads E as an answer and agrees with the tool's own total", () => {
    const papers = readPapers(grid, map, N, 5);
    assert.equal(papers[0].responses[19], "E");
    assert.equal(papers[0].captureNumCorrect, 100);
    assert.equal(papers[1].captureNumCorrect, 99);
  });

  it("offers the file's own key so nobody retypes 100 letters", () => {
    const found = readCapturedKey(readPapers(grid, map, N, 5), N);
    assert.equal(found, key.join(""));
  });

  // The clamp models what a bubble sheet can physically carry; the tool's key is
  // typed in, so an E there against a four-option exam is a real disagreement
  // and must still be readable rather than swallowed as noise.
  it("still reads the file's key when the exam is set to four options", () => {
    const papers = readPapers(grid, map, N, 4);
    assert.equal(papers[0].responses[19], "?", "the student's E is a misread here");
    assert.equal(readCapturedKey(papers, N), key.join(""));
  });

  it("offers no key when the rows disagree about it", () => {
    const mixed = [header, grid[1], row(["MIXED", "KEY"], "27", answersA)];
    mixed[2][17] = "D"; // PriKey2 on the second row only
    assert.equal(readCapturedKey(readPapers(mixed, map, N), N), null);
  });
});

describe("isDerivedSeriesHeader", () => {
  it("knows the tool's marking columns from the answer columns", () => {
    for (const h of ["Points1", "Mark12", "Score3", "Percent9"]) {
      assert.equal(isDerivedSeriesHeader(h), true, h);
    }
    for (const h of ["Stu1", "PriKey20", "Q7", "Answer3"]) {
      assert.equal(isDerivedSeriesHeader(h), false, h);
    }
  });
});
