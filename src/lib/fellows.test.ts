import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  deriveBatch,
  FELLOW_COMMITMENTS,
  FELLOW_DECLARATIONS,
  FELLOW_SHEET_COLUMNS,
  initialFellowFormData,
  mapFellowFields,
  toSheetRow,
} from "./fellows";
import { scoreScenarios } from "./fellows-scoring";

describe("deriveBatch", () => {
  it("reads the batch out of a standard state code", () => {
    assert.equal(deriveBatch("OG/26A/1234"), "Batch A 2026");
  });

  it("tolerates lowercase and stray spacing", () => {
    assert.equal(deriveBatch("og/ 25c /0087"), "Batch C 2025");
  });

  it("returns empty rather than guessing when the code is not standard", () => {
    assert.equal(deriveBatch("OG-26-1234"), "");
    assert.equal(deriveBatch(""), "");
    assert.equal(deriveBatch("not a code"), "");
  });
});

describe("scoreScenarios", () => {
  it("scores both judgement questions", () => {
    assert.deepEqual(scoreScenarios({ scenario1: "b", scenario2: "b" }), {
      score: 2,
      outOf: 2,
    });
  });

  it("scores a partial answer", () => {
    assert.deepEqual(scoreScenarios({ scenario1: "b", scenario2: "c" }), {
      score: 1,
      outOf: 2,
    });
  });

  it("gives nothing for unanswered questions", () => {
    assert.deepEqual(scoreScenarios({ scenario1: "", scenario2: "" }), {
      score: 0,
      outOf: 2,
    });
  });
});

describe("the sheet row", () => {
  const application = {
    ...initialFellowFormData,
    fullName: "Amina Bello",
    phone: "0803 123 4567",
    email: "amina@example.com",
    gender: "Female",
    stateCode: "OG/26A/1234",
    ppa: "Community High School, Odeda",
    ppaIsSecondarySchool: "Yes",
    ppaLga: "Odeda",
    courseOfStudy: "Microbiology",
    commitments: [...FELLOW_COMMITMENTS],
    preferredCentre: "Abeokuta Grammar School, Abeokuta",
    acceptsAnotherCentre: "Yes",
    roles: ["Invigilator", "Centre Lead"],
    invigilatedBefore: "No",
    scenario1: "b",
    scenario2: "c",
    declarations: [...FELLOW_DECLARATIONS],
  };

  const meta = { submittedAt: "2026-08-29T09:00:00.000Z", scenarioScore: 1, scenarioOutOf: 2 };

  it("lines up one value per column, in the sheet's order", () => {
    const row = toSheetRow(mapFellowFields(application, meta));
    assert.equal(row.length, FELLOW_SHEET_COLUMNS.length);
    assert.equal(row[FELLOW_SHEET_COLUMNS.indexOf("Full name")], "Amina Bello");
    assert.equal(row[FELLOW_SHEET_COLUMNS.indexOf("Batch (derived)")], "Batch A 2026");
    assert.equal(row[FELLOW_SHEET_COLUMNS.indexOf("Scenario score")], "1/2");
  });

  it("writes the scenario answer with its label, so the sheet reads without a key", () => {
    const fields = mapFellowFields(application, meta);
    assert.match(fields["Scenario 1"], /^b — Ask the candidate to remain seated/);
    assert.match(fields["Scenario 2"], /^c — Seize both scripts/);
  });

  it("records the commitment and declaration as confirmed only when complete", () => {
    const complete = mapFellowFields(application, meta);
    assert.equal(complete["Commitment confirmed"], "Yes");
    assert.equal(complete.Declaration, "Confirmed");

    const partial = mapFellowFields(
      { ...application, commitments: [FELLOW_COMMITMENTS[0]], declarations: [] },
      meta,
    );
    assert.equal(partial["Commitment confirmed"], "No");
    assert.equal(partial.Declaration, "Incomplete");
  });
});
