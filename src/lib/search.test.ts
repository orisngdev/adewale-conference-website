import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  escapeLikePattern,
  normalizeSearchText,
  searchHaystackMatches,
  searchTokens,
} from "./search";

describe("search helpers", () => {
  it("normalizes punctuation variants in school names", () => {
    assert.equal(
      normalizeSearchText("REMO DIVISIONAL HIGH SCHOOL (SNR), SAGAMU"),
      "remo divisional high school snr sagamu",
    );
  });

  it("matches punctuation-insensitive school queries", () => {
    assert.equal(
      searchHaystackMatches(
        ["REMO DIVISIONAL HIGH SCHOOL (SNR), SAGAMU"],
        "REMO DIVISIONAL HIGH SCHOOL SNR SAGAMU",
      ),
      true,
    );
    assert.equal(
      searchHaystackMatches(["EMINENCE COLLEGE, OTA"], "EMINENCE COLLEGE OTA"),
      true,
    );
  });

  it("supports non-contiguous query tokens", () => {
    assert.deepEqual(searchTokens("remo sagamu"), ["remo", "sagamu"]);
    assert.equal(
      searchHaystackMatches(["REMO DIVISIONAL HIGH SCHOOL (SNR), SAGAMU"], "remo sagamu"),
      true,
    );
  });

  it("escapes PostgREST ilike wildcards", () => {
    assert.equal(escapeLikePattern("100%_ready\\"), "100\\%\\_ready\\\\");
  });
});
