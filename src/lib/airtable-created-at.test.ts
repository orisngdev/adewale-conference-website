import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { airtableCreatedAt } from "./airtable-created-at";

describe("airtableCreatedAt", () => {
  it("prefers the Airtable Created time field when it exists", () => {
    assert.equal(
      airtableCreatedAt({
        id: "rec1",
        createdTime: "2026-07-27T09:00:00.000Z",
        fields: { "Created time": "2026-06-15T12:30:00.000Z" },
      }),
      "2026-06-15T12:30:00.000Z",
    );
  });

  it("falls back to the Airtable record createdTime", () => {
    assert.equal(
      airtableCreatedAt({
        id: "rec1",
        createdTime: "2026-07-27T09:00:00.000Z",
        fields: {},
      }),
      "2026-07-27T09:00:00.000Z",
    );
  });

  it("ignores invalid created_at field values", () => {
    assert.equal(
      airtableCreatedAt({
        id: "rec1",
        createdTime: "2026-07-27T09:00:00.000Z",
        fields: { created_at: "not a date" },
      }),
      "2026-07-27T09:00:00.000Z",
    );
  });
});
