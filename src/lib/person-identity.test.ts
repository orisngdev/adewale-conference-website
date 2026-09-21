import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizePersonName, personNameKey, personNameProblem } from "./person-identity";

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

describe("personNameProblem", () => {
  // The one that got through and printed on a school's answer-sheet packs.
  it("rejects a replacement request typed into a name box", () => {
    assert.match(
      personNameProblem("Change Akubo Faith to Lawal rodiat") ?? "",
      /not an instruction/,
    );
  });

  it("rejects the other ways that request gets phrased", () => {
    for (const text of [
      "Please replace Ada with Ben",
      "remove this teacher",
      "kindly update to Mrs Okoro",
      "Ada Bright instead",
    ]) {
      assert.ok(personNameProblem(text), `should reject: ${text}`);
    }
  });

  // Real teacher names from the 2026 roster — punctuation, titles and a digit.
  it("accepts the awkward names this data actually contains", () => {
    for (const name of [
      "Mr&Mrs Oyewole Olamide",
      "Talabi, O. A(Mr)",
      "Adelabu Adekunle 3",
      "MUFUTAU,  Lukman Ajewole",
      "Mr. Ajifola Adebayo Olasunkanmi",
      "Abdullahi Anjolajesu Christianah",
    ]) {
      assert.equal(personNameProblem(name), null, `should accept: ${name}`);
    }
  });

  it("rejects something far too long to be a name", () => {
    assert.ok(personNameProblem("a".repeat(61)));
    assert.ok(personNameProblem("One Two Three Four Five Six Seven Eight Nine"));
  });

  // The field is optional; emptiness is the caller's rule, not this one's.
  it("passes an empty value through", () => {
    assert.equal(personNameProblem(""), null);
    assert.equal(personNameProblem("   "), null);
  });
});
