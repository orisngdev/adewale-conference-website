import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCodeLoginEmail, studentAuthEmail } from "./student-accounts";

describe("studentAuthEmail", () => {
  it("mints the address code-login sign-in looks up, lower-cased", () => {
    assert.equal(
      studentAuthEmail("9XYMOH"),
      "student.9xymoh@students.adewaleconference.local",
    );
  });
});

describe("isCodeLoginEmail", () => {
  // Regression: a code-login student was shown the "Change password" form on
  // /portal/student/settings, set a password, and permanently broke their own
  // sign-in — the access code stayed in students.access_code while the account
  // password moved, and nothing re-syncs them. These accounts must be
  // recognisable so the password form is never offered to them.
  it("recognises a provisioned rep's synthetic address", () => {
    assert.equal(isCodeLoginEmail(studentAuthEmail("9XYMOH")), true);
    assert.equal(
      isCodeLoginEmail("STUDENT.9XYMOH@Students.AdewaleConference.Local"),
      true,
    );
    assert.equal(isCodeLoginEmail("  student.ab12cd@students.adewaleconference.local  "), true);
  });

  it("leaves real accounts alone, so they keep normal password management", () => {
    assert.equal(isCodeLoginEmail("student@gmail.com"), false);
    assert.equal(isCodeLoginEmail("teacher@school.test"), false);
    // A self-signed-up Student is a real account, not a code-login one.
    assert.equal(isCodeLoginEmail("olasubomi@gmail.com"), false);
  });

  it("does not match a look-alike domain or malformed input", () => {
    assert.equal(isCodeLoginEmail("student.ab12cd@students.adewaleconference.local.evil.com"), false);
    assert.equal(isCodeLoginEmail("students.adewaleconference.local"), false);
    assert.equal(isCodeLoginEmail(""), false);
    assert.equal(isCodeLoginEmail(null), false);
    assert.equal(isCodeLoginEmail(undefined), false);
  });
});
