import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateSchoolScore,
  applyCutoff,
  compareKeys,
  formatCandidateNumber,
  gradePaper,
  groupByLga,
  groupItemsBySubject,
  paperItemState,
  paperExamPhase,
  parseAnswerKey,
  percent,
  publicQualificationLabel,
  rankBy,
  UNPLACED_LGA,
  type PaperExamFacts,
  type PaperItem,
  type Ranked,
  type Response,
} from "./paper-exam";

// A 10-item paper with INTERLEAVED subjects (not contiguous blocks) — the whole
// point of a per-item subject tag. Key: 'A' on odd items, 'B' on even.
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology"];
const ITEMS: PaperItem[] = Array.from({ length: 10 }, (_, i) => {
  const position = i + 1;
  return {
    position,
    subject: SUBJECTS[i % 4],
    correct: position % 2 === 1 ? "A" : "B",
  } as PaperItem;
});

const PERFECT: Response[] = ["A", "B", "A", "B", "A", "B", "A", "B", "A", "B"];

describe("gradePaper", () => {
  it("scores a perfect paper and splits it by subject", () => {
    const r = gradePaper(ITEMS, PERFECT);
    assert.equal(r.total, 10);
    assert.equal(r.out_of, 10);
    assert.equal(r.attempted, 10);
    assert.equal(r.invalid, 0);
    // 10 interleaved items over 4 subjects: Maths 1,5,9 / Physics 2,6,10 /
    // Chemistry 3,7 / Biology 4,8
    assert.deepEqual(r.subscores.Mathematics, { correct: 3, out_of: 3 });
    assert.deepEqual(r.subscores.Physics, { correct: 3, out_of: 3 });
    assert.deepEqual(r.subscores.Chemistry, { correct: 2, out_of: 2 });
    assert.deepEqual(r.subscores.Biology, { correct: 2, out_of: 2 });
  });

  it("scores zero but still reports every subject's denominator", () => {
    const r = gradePaper(ITEMS, Array(10).fill("C") as Response[]);
    assert.equal(r.total, 0);
    assert.equal(r.attempted, 10);
    assert.deepEqual(r.subscores.Mathematics, { correct: 0, out_of: 3 });
  });

  // Mirrors the SQL integration case exactly: 4 right, one double-bubble, four
  // blanks, one right at the end.
  it("counts blanks and double-bubbles as wrong, and separates them", () => {
    const responses: Response[] = ["A", "B", "A", "B", "?", null, null, null, null, "B"];
    const r = gradePaper(ITEMS, responses);
    assert.equal(r.total, 5);
    assert.equal(r.attempted, 5, "a blank and a '?' are both not attempted");
    assert.equal(r.invalid, 1);
  });

  it("treats a short responses array as trailing blanks", () => {
    const r = gradePaper(ITEMS, ["A"]);
    assert.equal(r.total, 1);
    assert.equal(r.attempted, 1);
  });

  it("never credits a blank or a '?' even when the key would match", () => {
    assert.equal(gradePaper([{ position: 1, subject: "M", correct: "A" }], [null]).total, 0);
    assert.equal(gradePaper([{ position: 1, subject: "M", correct: "A" }], ["?"]).total, 0);
  });

  it("reads responses by printed position, not array order", () => {
    const items: PaperItem[] = [{ position: 3, subject: "M", correct: "C" }];
    assert.equal(gradePaper(items, [null, null, "C"]).total, 1);
  });

  it("handles an empty paper without dividing by anything", () => {
    const r = gradePaper([], []);
    assert.deepEqual(r, { total: 0, out_of: 0, attempted: 0, invalid: 0, subscores: {} });
  });
});

describe("parseAnswerKey", () => {
  const SUBS = ["Mathematics", "Physics", "Chemistry", "Biology"];

  it("reads a bare answer string with subject ranges — the blocked paper", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABCDABCD",
      subjects: SUBS,
      subjectMap: "1-2 Mathematics\n3-4 Physics\n5-6 Chemistry\n7-8 Biology",
      itemCount: 8,
    });
    assert.deepEqual(errors, []);
    assert.equal(items.length, 8);
    assert.deepEqual(items[0], { position: 1, subject: "Mathematics", correct: "A" });
    assert.deepEqual(items[7], { position: 8, subject: "Biology", correct: "D" });
  });

  // Both sheets are in use. The 2025 key has an E at item 20, so a five-option
  // exam must accept it — and a four-option one must refuse it, or every student
  // is graded against an answer their sheet could not carry.
  it("accepts E on a five-option paper, in a run and one per line", () => {
    const run = parseAnswerKey({
      answers: "ABCDE",
      subjects: ["Mathematics"],
      subjectMap: "",
      itemCount: 5,
      optionCount: 5,
    });
    assert.deepEqual(run.errors, []);
    assert.equal(run.items[4].correct, "E");

    const lines = parseAnswerKey({
      answers: "1,A\n2,E",
      subjects: ["Mathematics"],
      subjectMap: "",
      itemCount: 2,
      optionCount: 5,
    });
    assert.deepEqual(lines.errors, []);
    assert.equal(lines.items[1].correct, "E");
  });

  it("refuses E on a four-option paper, and says what to change", () => {
    for (const answers of ["ABCDE", "1,A\n2,B\n3,C\n4,D\n5,E"]) {
      const r = parseAnswerKey({
        answers,
        subjects: ["Mathematics"],
        subjectMap: "",
        itemCount: 5,
        optionCount: 4,
      });
      const message = r.errors.map((e) => e.message).join(" ");
      assert.match(message, /not on this paper/, answers);
      assert.match(message, /4 options, A to D/, answers);
    }
  });

  it("defaults to four options when the exam does not say", () => {
    const r = parseAnswerKey({
      answers: "ABCDE",
      subjects: ["Mathematics"],
      subjectMap: "",
      itemCount: 5,
    });
    assert.equal(r.errors.length, 1);
  });

  it("accepts ranges written with a comma, colon or the word to", () => {
    for (const map of ["1-4, Mathematics\n5-8: Physics", "1 to 4 Mathematics\n5 to 8 Physics"]) {
      const { items, errors } = parseAnswerKey({
        answers: "ABCDABCD",
        subjects: SUBS,
        subjectMap: map,
        itemCount: 8,
      });
      assert.deepEqual(errors, [], map);
      assert.equal(items[4].subject, "Physics");
    }
  });

  it("cycles the subject list when told to — the interleaved paper", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABCDABCD",
      subjects: SUBS,
      subjectMap: "cycle",
      itemCount: 8,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(
      items.slice(0, 5).map((i) => i.subject),
      ["Mathematics", "Physics", "Chemistry", "Biology", "Mathematics"],
    );
  });

  it("assigns the only subject everywhere when there is just one", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABC",
      subjects: ["Mathematics"],
      itemCount: 3,
    });
    assert.deepEqual(errors, []);
    assert.ok(items.every((i) => i.subject === "Mathematics"));
  });

  // The dangerous case: cycling a blocked paper would mis-tag every item and
  // corrupt every student's breakdown, invisibly.
  it("refuses to guess the layout when several subjects and no map are given", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABCD",
      subjects: SUBS,
      itemCount: 4,
    });
    assert.equal(items.length, 0);
    assert.match(errors.map((e) => e.message).join(" "), /which questions belong to which subject/);
    assert.equal(errors[0].field, "subjects");
  });

  it("reads one line per item", () => {
    const { items, errors } = parseAnswerKey({
      answers: "1,A\n2. B\n3: C",
      subjects: ["Mathematics"],
      itemCount: 3,
    });
    assert.deepEqual(errors, []);
    assert.deepEqual(items.map((i) => i.correct), ["A", "B", "C"]);
  });

  it("counts the answers and says so when the total is wrong", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABC",
      subjects: ["Mathematics"],
      itemCount: 5,
    });
    assert.equal(items.length, 0);
    assert.match(errors.map((e) => e.message).join(" "), /Found 3 answers, but this paper has 5 questions/);
    assert.equal(errors[0].field, "answers", "flagged on the answers field");
    assert.equal(errors.length, 1, "one message per mistake, not two");
  });

  it("names uncovered items as ranges, not as a wall of numbers", () => {
    const { errors } = parseAnswerKey({
      answers: "A".repeat(30),
      subjects: SUBS,
      subjectMap: "1-5 Mathematics",
      itemCount: 30,
    });
    assert.match(errors.map((e) => e.message).join(" "), /No subject given for questions 6–30/);
    assert.ok(errors.every((e) => e.field === "subjects"), "flagged on the subjects field");
  });

  it("rejects a subject that is not on the exam's list", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABCD",
      subjects: SUBS,
      subjectMap: "1-4 Astrology",
      itemCount: 4,
    });
    assert.equal(items.length, 0);
    assert.match(
      errors.map((e) => e.message).join(" "),
      /“Astrology” is not one of this exam's subjects/,
    );
    assert.equal(errors[0].field, "subjects");
  });

  it("matches subject names case- and spacing-insensitively", () => {
    const { items, errors } = parseAnswerKey({
      answers: "ABCD",
      subjects: ["Mathematics & Number Theory"],
      subjectMap: "1-4  mathematics  &  number theory",
      itemCount: 4,
    });
    assert.deepEqual(errors, []);
    assert.equal(items[0].subject, "Mathematics & Number Theory");
  });

  it("rejects a range outside the paper", () => {
    const { errors } = parseAnswerKey({
      answers: "ABCD",
      subjects: SUBS,
      subjectMap: "1-4 Mathematics\n5-9 Physics",
      itemCount: 4,
    });
    assert.match(errors.map((e) => e.message).join(" "), /outside this paper's 1–4/);
    assert.equal(errors[0].field, "subjects");
  });

  it("saves nothing at all when anything is wrong", () => {
    // A partial key would score every unlisted item wrong for every student.
    const { items } = parseAnswerKey({
      answers: "AB",
      subjects: SUBS,
      subjectMap: "1-2 Mathematics",
      itemCount: 4,
    });
    assert.deepEqual(items, []);
  });

  it("lets a later line override an earlier one for the same item", () => {
    const { items, errors } = parseAnswerKey({
      answers: "AB",
      subjects: SUBS,
      subjectMap: "1-2 Mathematics\n2, Physics",
      itemCount: 2,
    });
    assert.deepEqual(errors, []);
    assert.equal(items[1].subject, "Physics");
  });
});

describe("compareKeys", () => {
  it("reports nothing when the keys agree", () => {
    assert.deepEqual(compareKeys(ITEMS, PERFECT), []);
  });

  it("names the positions where the capture tool's key disagrees", () => {
    const theirs = [...PERFECT];
    theirs[2] = "D";
    theirs[7] = "C";
    assert.deepEqual(compareKeys(ITEMS, theirs), [3, 8]);
  });

  it("ignores positions the tool left blank rather than flagging them", () => {
    const theirs: Response[] = [...PERFECT];
    theirs[0] = null;
    assert.deepEqual(compareKeys(ITEMS, theirs), []);
  });
});

describe("percent", () => {
  it("rounds to one decimal place", () => {
    assert.equal(percent(1, 3), 33.3);
    assert.equal(percent(10, 10), 100);
  });

  it("returns 0 rather than NaN for an empty paper", () => {
    assert.equal(percent(0, 0), 0);
  });
});

describe("paperItemState", () => {
  // The distinction this exists to make: the old view rendered all three of
  // these as a red ✗, so an unmarked paper looked like 100 wrong answers.
  it("separates blank, unreadable and ungraded from a wrong answer", () => {
    assert.equal(paperItemState({ choice: null, is_correct: false }), "blank");
    assert.equal(paperItemState({ choice: "?", is_correct: false }), "unreadable");
    assert.equal(paperItemState({ choice: "B", is_correct: null }), "ungraded");
    assert.equal(paperItemState({ choice: "B", is_correct: false }), "wrong");
    assert.equal(paperItemState({ choice: "B", is_correct: true }), "correct");
  });

  it("calls a blank blank even where the grader marked it", () => {
    assert.equal(paperItemState({ choice: null, is_correct: true }), "blank");
  });
});

describe("groupItemsBySubject", () => {
  const items = [
    { position: 3, subject: "Physics", is_correct: true },
    { position: 1, subject: "Biology", is_correct: true },
    { position: 4, subject: "Physics", is_correct: false },
    { position: 2, subject: "Biology", is_correct: null },
  ];

  it("follows the exam's subject order, not first appearance", () => {
    const groups = groupItemsBySubject(items, ["Biology", "Physics"]);
    assert.deepEqual(groups.map((g) => g.subject), ["Biology", "Physics"]);
  });

  it("orders items by position inside each subject", () => {
    const [biology] = groupItemsBySubject(items, ["Biology", "Physics"]);
    assert.deepEqual(biology.items.map((i) => i.position), [1, 2]);
  });

  it("counts only a true verdict as correct, so ungraded is not a mark", () => {
    const [biology, physics] = groupItemsBySubject(items, ["Biology", "Physics"]);
    assert.deepEqual([biology.correct, biology.outOf], [1, 2]);
    assert.deepEqual([physics.correct, physics.outOf], [1, 2]);
  });

  it("keeps a subject the exam never listed, at the tail", () => {
    const withExtra = [...items, { position: 5, subject: "Latin", is_correct: true }];
    const groups = groupItemsBySubject(withExtra, ["Biology", "Physics"]);
    assert.deepEqual(groups.map((g) => g.subject), ["Biology", "Physics", "Latin"]);
  });

  it("falls back to a stable order with no exam subject list", () => {
    assert.deepEqual(
      groupItemsBySubject(items).map((g) => g.subject),
      ["Biology", "Physics"],
    );
  });
});

describe("formatCandidateNumber", () => {
  it("pads to the 3 digits the bubble box holds", () => {
    assert.equal(formatCandidateNumber("7"), "007");
    assert.equal(formatCandidateNumber("42"), "042");
    assert.equal(formatCandidateNumber(7), "007");
  });

  it("leaves a number that is already 3 digits alone", () => {
    assert.equal(formatCandidateNumber("007"), "007");
    assert.equal(formatCandidateNumber("547"), "547");
  });

  it("passes anything that isn't a plain number through untouched", () => {
    assert.equal(formatCandidateNumber(null), "");
    assert.equal(formatCandidateNumber(""), "");
    assert.equal(formatCandidateNumber("1042"), "1042");
    assert.equal(formatCandidateNumber("12A"), "12A");
  });
});

describe("paperExamPhase", () => {
  const nothing: PaperExamFacts = {
    keyComplete: false,
    sheetsReady: false,
    hasStagedImport: false,
    hasPublishedPapers: false,
    published: false,
  };

  it("starts at draft", () => {
    assert.equal(paperExamPhase(nothing).key, "draft");
  });

  it("advances on the key alone, then on the numbers", () => {
    assert.equal(paperExamPhase({ ...nothing, keyComplete: true }).key, "key");
    assert.equal(
      paperExamPhase({ ...nothing, keyComplete: true, sheetsReady: true }).key,
      "ready",
    );
  });

  it("says import, not sit, for a past sitting", () => {
    const f = { ...nothing, keyComplete: true, sheetsReady: true, isBackfill: true };
    assert.equal(paperExamPhase(f).label, "Ready to import");
  });

  it("reports grading while papers are staged, and scored once committed", () => {
    const graded = { ...nothing, keyComplete: true, sheetsReady: true, hasStagedImport: true };
    assert.equal(paperExamPhase(graded).key, "grading");
    assert.equal(paperExamPhase({ ...graded, hasPublishedPapers: true }).key, "scored");
  });

  // The bug this exists to prevent: every step done, the stored label still
  // reading "draft" because nothing but a committed cutoff ever moves it.
  it("never reports draft once anything has happened", () => {
    const done: PaperExamFacts = {
      keyComplete: true,
      sheetsReady: true,
      hasStagedImport: true,
      hasPublishedPapers: true,
      published: false,
    };
    assert.equal(paperExamPhase(done).key, "scored");
    assert.equal(paperExamPhase({ ...done, published: true }).key, "published");
  });
});

describe("aggregateSchoolScore", () => {
  const reps = [
    { studentId: "a", total: 40, outOf: 100 },
    { studentId: "b", total: 70, outOf: 100 },
    { studentId: "c", total: 55, outOf: 100 },
  ];

  it("sums all reps (the chosen rule) and sums their denominators", () => {
    assert.deepEqual(aggregateSchoolScore(reps, "sum_all"), {
      score: 165,
      score_max: 300,
      counted: 3,
    });
  });

  it("sums the top N and keeps the denominator at the full N", () => {
    assert.deepEqual(aggregateSchoolScore(reps, "sum_top_n", 2), {
      score: 125,
      score_max: 200,
      counted: 2,
    });
  });

  it("scores a short-handed school out of the full N under sum_top_n", () => {
    const short = [{ studentId: "a", total: 60, outOf: 100 }];
    assert.deepEqual(aggregateSchoolScore(short, "sum_top_n", 3), {
      score: 60,
      score_max: 300,
      counted: 1,
    });
  });

  it("averages the reps who sat", () => {
    assert.deepEqual(aggregateSchoolScore(reps, "mean_present"), {
      score: 55,
      score_max: 100,
      counted: 3,
    });
  });

  it("takes the best single rep", () => {
    assert.deepEqual(aggregateSchoolScore(reps, "best"), {
      score: 70,
      score_max: 100,
      counted: 1,
    });
  });

  it("returns a zero score for a school with no papers, not NaN", () => {
    assert.deepEqual(aggregateSchoolScore([], "mean_present"), {
      score: 0,
      score_max: 0,
      counted: 0,
    });
  });
});

describe("rankBy", () => {
  const rows = [
    { id: "a", score: 90, lga: "Ikeja" },
    { id: "b", score: 70, lga: "Ikeja" },
    { id: "c", score: 90, lga: "Epe" },
    { id: "d", score: 50, lga: "Epe" },
  ];

  it("ranks highest first", () => {
    const out = rankBy(rows, (r) => r.score);
    assert.equal(out.find((o) => o.row.id === "b")?.rank, 3);
  });

  it("shares a rank on a tie and skips the next one", () => {
    const tied = [
      { id: "a", score: 90 },
      { id: "b", score: 90 },
      { id: "c", score: 80 },
    ];
    const out = rankBy(tied, (r) => r.score);
    assert.equal(out.find((o) => o.row.id === "a")?.rank, 1);
    assert.equal(out.find((o) => o.row.id === "b")?.rank, 1);
    assert.equal(out.find((o) => o.row.id === "c")?.rank, 3, "rank 2 is skipped");
  });

  it("produces an independent ladder per group", () => {
    const out = rankBy(rows, (r) => r.score, (r) => r.lga);
    assert.equal(out.find((o) => o.row.id === "c")?.rank, 1, "top of Epe");
    assert.equal(out.find((o) => o.row.id === "a")?.rank, 1, "top of Ikeja");
    assert.equal(out.find((o) => o.row.id === "d")?.rank, 2);
  });

  it("returns nothing for no rows", () => {
    assert.deepEqual(rankBy([], (r: { score: number }) => r.score), []);
  });
});

describe("applyCutoff", () => {
  const mk = (rows: { id: string; score: number }[]): Ranked<{ id: string; score: number }>[] =>
    rankBy(rows, (r) => r.score);
  const score = (r: { score: number }) => r.score;

  it("advances the top N and eliminates the rest", () => {
    const out = applyCutoff(
      mk([
        { id: "a", score: 90 },
        { id: "b", score: 80 },
        { id: "c", score: 70 },
      ]),
      score,
      { kind: "top_n", n: 2 },
    );
    assert.equal(out.advanced, 2);
    assert.equal(out.eliminated, 1);
    assert.equal(out.cutScore, 80);
    assert.deepEqual(out.tiedAtCut, []);
  });

  // The case that must never be resolved by sort order.
  it("flags a tie that STRADDLES the cut", () => {
    const out = applyCutoff(
      mk([
        { id: "a", score: 90 },
        { id: "b", score: 80 },
        { id: "c", score: 80 },
      ]),
      score,
      { kind: "top_n", n: 2 },
    );
    assert.equal(out.tiedAtCut.length, 2, "both 80s must be surfaced");
    assert.deepEqual(
      out.tiedAtCut.map((r) => r.id).sort(),
      ["b", "c"],
    );
  });

  it("does not flag a tie that falls entirely inside the cut", () => {
    const out = applyCutoff(
      mk([
        { id: "a", score: 80 },
        { id: "b", score: 80 },
        { id: "c", score: 70 },
      ]),
      score,
      { kind: "top_n", n: 2 },
    );
    assert.deepEqual(out.tiedAtCut, []);
  });

  it("does not flag a tie that falls entirely outside the cut", () => {
    const out = applyCutoff(
      mk([
        { id: "a", score: 90 },
        { id: "b", score: 70 },
        { id: "c", score: 70 },
      ]),
      score,
      { kind: "top_n", n: 1 },
    );
    assert.deepEqual(out.tiedAtCut, []);
  });

  it("min_score advances everyone on the threshold, so it can never split a tie", () => {
    const out = applyCutoff(
      mk([
        { id: "a", score: 80 },
        { id: "b", score: 50 },
        { id: "c", score: 50 },
      ]),
      score,
      { kind: "min_score", min: 50 },
    );
    assert.equal(out.advanced, 3);
    assert.equal(out.cutScore, 50);
    assert.deepEqual(out.tiedAtCut, []);
  });

  it("handles an N larger than the field", () => {
    const out = applyCutoff(mk([{ id: "a", score: 10 }]), score, { kind: "top_n", n: 5 });
    assert.equal(out.advanced, 1);
    assert.equal(out.eliminated, 0);
  });

  it("handles an empty field", () => {
    const out = applyCutoff([], score, { kind: "top_n", n: 3 });
    assert.equal(out.advanced, 0);
    assert.equal(out.cutScore, null);
  });
});

// Regression: pasting 80 of 100 answers produced TWO messages for one mistake
// ("Found 80 answers…" plus "No answer given for items 81–100"), which read as
// two separate problems.
describe("parseAnswerKey — one message per mistake", () => {
  it("does not restate a wrong answer count as missing answers", () => {
    const { errors } = parseAnswerKey({
      answers: "A".repeat(80),
      subjects: ["Mathematics"],
      itemCount: 100,
    });
    assert.equal(errors.length, 1, errors.map((e) => e.message).join(" | "));
    assert.match(errors[0].message, /80 answers.*100 questions.*20 short/);
  });

  it("still reports gaps when the answers are given one per line", () => {
    // Here the count is right by construction, so a gap IS the real problem.
    const { errors } = parseAnswerKey({
      answers: "1,A\n2,B\n5,C",
      subjects: ["Mathematics"],
      itemCount: 5,
    });
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /No answer given for questions 3–4/);
    assert.equal(errors[0].field, "answers");
  });
});

// ── the real paper ──────────────────────────────────────────────────────────
// From the 2026 question booklet: five sections of 20, four options A-D
// ("Each question has four options lettered A to D"), and instruction 8 —
// "if two marks are detected, that question scores no mark" — which is exactly
// what a '?' response does here.
describe("the ASC 2026 paper", () => {
  const SUBJECTS = [
    "Chemistry",
    "Computing & Applied Technology",
    "Mathematics",
    "Biology",
    "Physics",
  ];
  const MAP = [
    "1-20 Chemistry",
    "21-40 Computing & Applied Technology",
    "41-60 Mathematics",
    "61-80 Biology",
    "81-100 Physics",
  ].join("\n");

  const key = (answers: string) =>
    parseAnswerKey({ answers, subjects: SUBJECTS, subjectMap: MAP, itemCount: 100, optionCount: 4 });

  it("splits 100 items into the five sections of 20", () => {
    const { items, errors } = key("ABCD".repeat(25));
    assert.deepEqual(errors, []);
    const counts: Record<string, number> = {};
    for (const i of items) counts[i.subject] = (counts[i.subject] ?? 0) + 1;
    assert.deepEqual(counts, {
      Chemistry: 20,
      "Computing & Applied Technology": 20,
      Mathematics: 20,
      Biology: 20,
      Physics: 20,
    });
    assert.equal(items[0].subject, "Chemistry");
    assert.equal(items[20].subject, "Computing & Applied Technology");
    assert.equal(items[99].subject, "Physics");
  });

  it("reads a subject name containing an ampersand", () => {
    assert.deepEqual(key("ABCD".repeat(25)).items[39].subject, "Computing & Applied Technology");
  });

  it("refuses an E, because this sheet is A to D", () => {
    const { errors } = key("E" + "B".repeat(99));
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /4 options, A to D/);
  });

  it("gives a double-bubbled question no mark, per instruction 8", () => {
    const { items } = key("B".repeat(100));
    const responses: Response[] = Array(100).fill("B");
    responses[0] = "?";
    const r = gradePaper(items, responses);
    assert.equal(r.total, 99);
    assert.equal(r.invalid, 1);
    assert.equal(r.subscores.Chemistry.correct, 19);
    assert.equal(r.subscores.Physics.correct, 20);
  });
});

describe("groupByLga", () => {
  const row = (rank: number, lgaRank: number, lga: string | null, school = `S${rank}`) => ({
    rank,
    lgaRank,
    lga,
    school,
  });

  it("buckets by LGA and names each bucket's champion", () => {
    const groups = groupByLga([
      row(1, 1, "Ado-Odo/Ota"),
      row(2, 2, "Ado-Odo/Ota"),
      row(3, 1, "Sagamu"),
    ]);
    assert.deepEqual(groups.map((g) => g.lga), ["Ado-Odo/Ota", "Sagamu"]);
    assert.equal(groups[0].champion?.rank, 1);
    assert.equal(groups[1].champion?.rank, 3);
  });

  it("puts the LGA holding the best-placed school first", () => {
    const groups = groupByLga([row(9, 1, "Odeda"), row(2, 1, "Ifo"), row(5, 2, "Odeda")]);
    assert.deepEqual(groups.map((g) => g.lga), ["Ifo", "Odeda"]);
  });

  it("orders schools within an LGA by their rank in that LGA", () => {
    const groups = groupByLga([row(8, 3, "Ifo"), row(2, 1, "Ifo"), row(5, 2, "Ifo")]);
    assert.deepEqual(groups[0].rows.map((r) => r.rank), [2, 5, 8]);
  });

  it("collects unplaced schools last and crowns no champion there", () => {
    const groups = groupByLga([row(1, 1, null), row(4, 1, "Ifo"), row(2, 2, "   ")]);
    assert.deepEqual(groups.map((g) => g.lga), ["Ifo", UNPLACED_LGA]);
    assert.equal(groups[1].champion, null);
    assert.equal(groups[1].rows.length, 2);
  });

  it("returns no groups for no standings", () => {
    assert.deepEqual(groupByLga([]), []);
  });
});

describe("publicQualificationLabel", () => {
  it("rewords the routes a reader can understand", () => {
    assert.equal(publicQualificationLabel("State-wide Qualification"), "Statewide qualifier");
    assert.equal(publicQualificationLabel("Divisional Qualification"), "Divisional qualifier");
    assert.equal(publicQualificationLabel("Top 10"), "Top 10 in the state");
    assert.equal(publicQualificationLabel("Zonal Champion"), "Zonal Champion");
  });

  it("shows no badge for internal bookkeeping", () => {
    assert.equal(publicQualificationLabel("Manual Selection"), null);
  });

  it("shows no badge for an unknown, empty or missing reason", () => {
    assert.equal(publicQualificationLabel("Something else"), null);
    assert.equal(publicQualificationLabel(""), null);
    assert.equal(publicQualificationLabel(null), null);
    assert.equal(publicQualificationLabel(undefined), null);
  });
});
