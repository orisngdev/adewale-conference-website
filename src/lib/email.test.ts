import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isUndeliverableAddress } from "./email";

// A send to a reserved domain is a guaranteed hard bounce, and bounce rate is
// scored against the sending domain's reputation — so the dev database's
// seeded educators must never reach SendGrid.
describe("isUndeliverableAddress", () => {
  it("rejects the reserved example domains (RFC 2606)", () => {
    assert.equal(isUndeliverableAddress("teacher1@example.com"), true);
    assert.equal(isUndeliverableAddress("a@example.net"), true);
    assert.equal(isUndeliverableAddress("a@example.org"), true);
  });

  it("rejects the reserved test TLDs", () => {
    for (const address of [
      "a@school.test",
      "a@foo.example",
      "a@nowhere.invalid",
      "a@box.localhost",
    ]) {
      assert.equal(isUndeliverableAddress(address), true, address);
    }
  });

  it("rejects the mDNS-only .local, where synthetic student addresses live", () => {
    assert.equal(
      isUndeliverableAddress("student.ab12cd@students.adewaleconference.local"),
      true,
    );
  });

  it("rejects every address this project's dev seeder generates", () => {
    // These are the shapes the deleted dev seeders generated. Kept as fixtures:
    // any new seeder that produces a deliverable-looking address should fail here.
    for (const address of [
      "teacher1@example.com",
      "principal20@example.com",
      "librarian19@example.com",
      "office7@example.com",
    ]) {
      assert.equal(isUndeliverableAddress(address), true, address);
    }
  });

  it("accepts real addresses, including plus-aliases and subdomains", () => {
    for (const address of [
      "hello@adewaleconference.org",
      "someone@gmail.com",
      "someone+t01@gmail.com",
      "head@school.sch.ng",
      "a@mail.example2.com",
    ]) {
      assert.equal(isUndeliverableAddress(address), false, address);
    }
  });

  it("treats a blank or malformed address as undeliverable", () => {
    assert.equal(isUndeliverableAddress(""), true);
    assert.equal(isUndeliverableAddress(null), true);
    assert.equal(isUndeliverableAddress(undefined), true);
    assert.equal(isUndeliverableAddress("no-at-sign"), true);
    assert.equal(isUndeliverableAddress("trailing@"), true);
  });

  it("ignores case and surrounding whitespace", () => {
    assert.equal(isUndeliverableAddress("  Teacher1@EXAMPLE.com "), true);
    assert.equal(isUndeliverableAddress("  Someone@Gmail.com "), false);
  });

  it("does not reject a domain that merely contains a reserved name", () => {
    // "example.company" is a perfectly real domain; only exact reserved
    // domains and reserved TLD suffixes are blocked.
    assert.equal(isUndeliverableAddress("a@example.company"), false);
    assert.equal(isUndeliverableAddress("a@notexample.com"), false);
    assert.equal(isUndeliverableAddress("a@localhost.com"), false);
  });
});
