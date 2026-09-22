import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { matchRoster, type RosterRow } from "./roster-match";

function row(over: Partial<RosterRow> & { name: string }): RosterRow {
  return {
    id: over.name,
    access_code: "AAA111",
    auth_user_id: "auth-" + over.name,
    edition_year: 2026,
    deactivated_at: null,
    ...over,
  };
}

describe("matchRoster", () => {
  it("has nothing to match against an empty roster", () => {
    assert.deepEqual(matchRoster([], "Ada Bright", 2026), { kind: "insert" });
  });

  it("reuses an active row, whatever order the name arrives in", () => {
    const ada = row({ name: "BRIGHT, Ada" });
    const m = matchRoster([ada], "Ada Bright", 2026);
    assert.equal(m.kind, "reuse");
    assert.equal(m.kind === "reuse" && m.row.id, ada.id);
  });

  it("adopts a history-only row rather than inserting beside it", () => {
    const ada = row({ name: "Ada Bright", access_code: null, auth_user_id: null });
    assert.equal(matchRoster([ada], "Ada Bright", 2026).kind, "adopt");
  });

  // The replacement-flow case: she was swapped out this edition and the school
  // now wants her back. Provisioning afresh would split her results in two.
  it("reports a rep retired in this edition as returning", () => {
    const ada = row({ name: "Ada Bright", deactivated_at: "2026-03-01T00:00:00Z" });
    const m = matchRoster([ada], "Ada Bright", 2026);
    assert.equal(m.kind, "returning");
    assert.equal(m.kind === "returning" && m.row.id, ada.id);
  });

  it("treats a rep retired in an earlier edition as a fresh provision", () => {
    const ada = row({
      name: "Ada Bright",
      edition_year: 2025,
      deactivated_at: "2025-03-01T00:00:00Z",
    });
    assert.deepEqual(matchRoster([ada], "Ada Bright", 2026), { kind: "insert" });
  });

  it("prefers the active row when a retired one shares the name", () => {
    const retired = row({ name: "Ada Bright", id: "old", deactivated_at: "2026-03-01T00:00:00Z" });
    const live = row({ name: "Ada Bright", id: "live" });
    const m = matchRoster([retired, live], "Ada Bright", 2026);
    assert.equal(m.kind, "reuse");
    assert.equal(m.kind === "reuse" && m.row.id, "live");
  });

  it("keeps different people apart", () => {
    const ben = row({ name: "Ben Bright", deactivated_at: "2026-03-01T00:00:00Z" });
    assert.deepEqual(matchRoster([ben], "Ada Bright", 2026), { kind: "insert" });
  });
});
