import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePersonName, personNameKey } from "./person-identity";

describe("normalizePersonName", () => {
  it("drops case, punctuation and extra whitespace", () => {
    assert.equal(normalizePersonName("  ADA-BRIGHT,  jr. "), "ada bright jr");
  });

  it("folds diacritics", () => {
    assert.equal(normalizePersonName("Adéwálé"), "adewale");
  });

  it("survives an empty string", () => {
    assert.equal(normalizePersonName(""), "");
  });
});

describe("personNameKey", () => {
  it("ignores word order", () => {
    assert.equal(personNameKey("BRIGHT ADA"), personNameKey("Ada Bright"));
  });

  // The real pairs that provisioned duplicate rows.
  it("agrees across the surname-first result-sheet format", () => {
    assert.equal(
      personNameKey("TIJANI, Rahmotallah Adebisi"),
      personNameKey("Rahmotallah Adebisi Tijani"),
    );
    assert.equal(
      personNameKey("SAIBU ABDULSALAM OPEYEMI"),
      personNameKey("Saibu AbdulSalam Opeyemi"),
    );
  });

  it("keeps different people apart", () => {
    assert.notEqual(personNameKey("Ada Bright"), personNameKey("Ben Bright"));
  });

  // Honest about the limit: this is an exact key, not a fuzzy matcher. A
  // misspelling or a differently-split token is a different student to it, and
  // the roster cap is what catches those.
  it("does not paper over a misspelling", () => {
    assert.notEqual(
      personNameKey("Amoda AbdulMuiz Olasunkanmi"),
      personNameKey("Amuda AbdulMuiz Olasunkanmi"),
    );
  });
});
