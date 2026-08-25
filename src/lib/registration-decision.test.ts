import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bulkDecisionSummary,
  partitionSelection,
  registrationDecisionOutcome,
} from "./registration-decision";

describe("registrationDecisionOutcome", () => {
  it("approves a declined registration and clears its decline reason", () => {
    assert.deepEqual(registrationDecisionOutcome("declined", "approve", null), {
      patch: { status: "verified", decline_reason: null },
      skipReason: null,
    });
  });

  it("approves a submitted registration", () => {
    assert.deepEqual(registrationDecisionOutcome("submitted", "approve", null), {
      patch: { status: "verified", decline_reason: null },
      skipReason: null,
    });
  });

  it("declines with the batch reason", () => {
    assert.deepEqual(registrationDecisionOutcome("submitted", "decline", "No female rep."), {
      patch: { status: "declined", decline_reason: "No female rep." },
      skipReason: null,
    });
  });

  it("declines a verified registration (a reversal is still a change)", () => {
    assert.deepEqual(registrationDecisionOutcome("verified", "decline", null), {
      patch: { status: "declined", decline_reason: null },
      skipReason: null,
    });
  });

  it("skips an already-verified registration so approve never re-sends", () => {
    const outcome = registrationDecisionOutcome("verified", "approve", null);
    assert.equal(outcome.patch, null);
    assert.match(outcome.skipReason ?? "", /already approved/);
  });

  it("skips an already-declined registration so decline never re-sends", () => {
    const outcome = registrationDecisionOutcome("declined", "decline", "Anything");
    assert.equal(outcome.patch, null);
    assert.match(outcome.skipReason ?? "", /already declined/);
  });

  it("always explains a skip", () => {
    for (const status of ["submitted", "verified", "declined"] as const) {
      for (const decision of ["approve", "decline"] as const) {
        const outcome = registrationDecisionOutcome(status, decision, null);
        assert.equal(
          outcome.patch === null,
          Boolean(outcome.skipReason),
          `${status}/${decision} must either write a patch or say why it did not`,
        );
      }
    }
  });
});

describe("partitionSelection", () => {
  const current = { id: "a", name: "Current School", edition_year: 2026 };
  const past = { id: "b", name: "Past School", edition_year: 2025 };

  it("passes through rows in the open edition", () => {
    const { open, skipped } = partitionSelection({
      ids: ["a"],
      rows: [current],
      latestYear: 2026,
    });
    assert.deepEqual(open, [current]);
    assert.deepEqual(skipped, []);
  });

  it("names both years when an edition is locked", () => {
    const { open, skipped } = partitionSelection({
      ids: ["b"],
      rows: [past],
      latestYear: 2026,
    });
    assert.deepEqual(open, []);
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].name, "Past School");
    assert.match(skipped[0].reason, /2025 edition/);
    assert.match(skipped[0].reason, /only 2026 is open/);
  });

  it("accounts for a selected id whose row is gone", () => {
    const { open, skipped } = partitionSelection({
      ids: ["a", "deleted-row-id"],
      rows: [current],
      latestYear: 2026,
    });
    assert.deepEqual(open, [current]);
    assert.equal(skipped.length, 1);
    assert.match(skipped[0].reason, /no longer exists/);
  });

  it("accounts for every selected id, always", () => {
    const { open, skipped } = partitionSelection({
      ids: ["a", "b", "ghost"],
      rows: [current, past],
      latestYear: 2026,
    });
    assert.equal(open.length + skipped.length, 3);
  });

  it("skips everything when no edition is readable, rather than writing blind", () => {
    const { open, skipped } = partitionSelection({
      ids: ["a"],
      rows: [current],
      latestYear: null,
    });
    assert.deepEqual(open, []);
    assert.match(skipped[0].reason, /only the current is open/);
  });
});

describe("bulkDecisionSummary", () => {
  it("says plainly when nothing changed", () => {
    const { ok, message } = bulkDecisionSummary({
      verb: "Approved",
      appliedCount: 0,
      skippedCount: 3,
      selectedCount: 3,
    });
    assert.equal(ok, false);
    assert.match(message, /No school changed/);
    assert.match(message, /all 3 schools you selected were left exactly as before/);
  });

  it("uses the singular when one school was selected", () => {
    const { message } = bulkDecisionSummary({
      verb: "Approved",
      appliedCount: 0,
      skippedCount: 1,
      selectedCount: 1,
    });
    assert.match(message, /the one you selected was left exactly as before/);
  });

  it("counts what changed and what did not", () => {
    const { ok, message } = bulkDecisionSummary({
      verb: "Approved",
      appliedCount: 12,
      skippedCount: 2,
      selectedCount: 14,
    });
    assert.equal(ok, true);
    assert.equal(message, "Approved 12 schools, and left 2 schools unchanged.");
  });

  it("omits the skip clause when everything applied", () => {
    const { message } = bulkDecisionSummary({
      verb: "Declined",
      appliedCount: 1,
      skippedCount: 0,
      selectedCount: 1,
    });
    assert.equal(message, "Declined 1 school.");
  });

  it("names the stage for a stage result", () => {
    const { message } = bulkDecisionSummary({
      verb: "Advanced",
      appliedCount: 4,
      skippedCount: 0,
      selectedCount: 4,
      at: "Quarter Finals",
    });
    assert.equal(message, "Advanced 4 schools at Quarter Finals.");
  });
});
