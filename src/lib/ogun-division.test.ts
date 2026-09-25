import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { divisionOf, mappedLgas, OGUN_DIVISIONS } from "./ogun-division";
import { LGA_OPTIONS } from "./forms";

describe("divisionOf", () => {
  // The guard that matters: if an LGA is added to the registration form and not
  // to the division map, divisional qualification silently skips its schools.
  it("covers every LGA the registration form offers, and invents none", () => {
    const mapped = [...mappedLgas()].sort();
    assert.deepEqual(mapped, [...LGA_OPTIONS].sort());
  });

  it("places each division's LGAs, matching how the results are announced", () => {
    assert.equal(divisionOf("Ado-Odo/Ota"), "Yewa");
    assert.equal(divisionOf("Abeokuta North"), "Egba");
    assert.equal(divisionOf("Ifo"), "Egba");
    assert.equal(divisionOf("Odeda"), "Egba");
    assert.equal(divisionOf("Ijebu North East"), "Ijebu");
    assert.equal(divisionOf("Sagamu"), "Remo");
  });

  it("ignores case, spacing and separators", () => {
    for (const written of ["Ado-Odo/Ota", "ADO ODO OTA", "ado-odo ota", "  Ado-Odo/Ota  "]) {
      assert.equal(divisionOf(written), "Yewa", written);
    }
  });

  // "Ijebu North" is a prefix of "Ijebu North East"; matching on a prefix would
  // put four Ijebu LGAs' schools in the wrong bucket.
  it("does not confuse an LGA with one whose name it starts", () => {
    assert.equal(divisionOf("Ijebu North"), "Ijebu");
    assert.equal(divisionOf("Ijebu North East"), "Ijebu");
    assert.notEqual(divisionOf("Ijebu North"), null);
  });

  it("returns null rather than guessing", () => {
    assert.equal(divisionOf("Ikeja"), null);
    assert.equal(divisionOf(""), null);
    assert.equal(divisionOf("   "), null);
    assert.equal(divisionOf(null), null);
    assert.equal(divisionOf(undefined), null);
  });

  it("names four divisions", () => {
    assert.equal(OGUN_DIVISIONS.length, 4);
  });
});
