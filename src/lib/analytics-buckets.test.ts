import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orderedBuckets, tally, topN } from "./analytics-buckets";

describe("analytics bucket helpers", () => {
  it("keeps every fixed bucket, including zero-count labels", () => {
    const counts = new Map([
      ["Sagamu", 17],
      ["Abeokuta North", 16],
    ]);

    assert.deepEqual(orderedBuckets(counts, ["Abeokuta North", "Sagamu", "Ikenne"]), [
      { label: "Abeokuta North", value: 16 },
      { label: "Sagamu", value: 17 },
      { label: "Ikenne", value: 0 },
    ]);
  });

  it("does not hide unexpected fixed-vocabulary values under Other", () => {
    const counts = new Map([
      ["Sagamu", 17],
      ["Legacy LGA spelling", 2],
    ]);

    assert.deepEqual(orderedBuckets(counts, ["Sagamu", "Ikenne"]), [
      { label: "Sagamu", value: 17 },
      { label: "Ikenne", value: 0 },
      { label: "Legacy LGA spelling", value: 2 },
    ]);
  });

  it("still supports top-N rollups for open-ended charts", () => {
    const counts = new Map([
      ["Challenge A", 5],
      ["Challenge B", 3],
      ["Challenge C", 1],
    ]);

    assert.deepEqual(topN(counts, 2, "Other challenges"), [
      { label: "Challenge A", value: 5 },
      { label: "Challenge B", value: 3 },
      { label: "Other challenges", value: 1 },
    ]);
  });

  it("tallies derived labels", () => {
    assert.deepEqual(
      tally([{ lga: "Sagamu" }, { lga: "Sagamu" }, { lga: null }], (r) => r.lga),
      new Map([["Sagamu", 2]]),
    );
  });
});

