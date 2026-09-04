import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRole,
  dedupeRecipients,
  isEducatorEmail,
  matchesTargetRole,
  type EducatorRecipient,
} from "./announcement-recipients";

function candidate(over: Partial<EducatorRecipient> = {}): EducatorRecipient {
  return {
    email: "teacher@school.test",
    name: "A Teacher",
    profileId: null,
    role: "member",
    schoolId: "school-1",
    source: "member",
    ...over,
  };
}

describe("isEducatorEmail", () => {
  it("rejects the synthetic address minted for code-login students", () => {
    assert.equal(isEducatorEmail("student.ab12cd@students.adewaleconference.local"), false);
  });

  it("accepts a real address and rejects empty or malformed ones", () => {
    assert.equal(isEducatorEmail("principal@school.test"), true);
    assert.equal(isEducatorEmail(""), false);
    assert.equal(isEducatorEmail(null), false);
    assert.equal(isEducatorEmail(undefined), false);
    assert.equal(isEducatorEmail("not-an-address"), false);
  });
});

describe("classifyRole", () => {
  const teachers = new Set(["teacher@school.test"]);
  const principals = new Set(["principal@school.test"]);

  it("matches the teacher and principal addresses on the entry", () => {
    assert.equal(classifyRole("teacher@school.test", teachers, principals), "teacher");
    assert.equal(classifyRole("principal@school.test", teachers, principals), "principal");
  });

  it("matches case-insensitively", () => {
    assert.equal(classifyRole("  TEACHER@School.test ", teachers, principals), "teacher");
  });

  it("falls back to member for anyone the entry does not name", () => {
    assert.equal(classifyRole("librarian@school.test", teachers, principals), "member");
    assert.equal(classifyRole(null, teachers, principals), "member");
  });
});

describe("matchesTargetRole", () => {
  it("lets everyone through for an all-educators send", () => {
    for (const role of ["teacher", "principal", "member"] as const) {
      assert.equal(matchesTargetRole(role, "all"), true);
    }
  });

  it("excludes principals AND unclassified members from a teachers-only send", () => {
    assert.equal(matchesTargetRole("teacher", "teacher"), true);
    assert.equal(matchesTargetRole("principal", "teacher"), false);
    assert.equal(matchesTargetRole("member", "teacher"), false);
  });

  it("excludes teachers AND unclassified members from a principals-only send", () => {
    assert.equal(matchesTargetRole("principal", "principal"), true);
    assert.equal(matchesTargetRole("teacher", "principal"), false);
    assert.equal(matchesTargetRole("member", "principal"), false);
  });
});

describe("dedupeRecipients", () => {
  it("counts a person once when they are both member and registration owner", () => {
    const resolved = dedupeRecipients([
      candidate({ email: "t@school.test", profileId: null, source: "member" }),
      candidate({ email: "t@school.test", profileId: "profile-1", source: "owner" }),
    ]);
    assert.equal(resolved.recipientCount, 1);
    assert.deepEqual(resolved.emails, [{ email: "t@school.test", name: "A Teacher" }]);
    assert.deepEqual(resolved.profileIds, ["profile-1"]);
  });

  it("counts one address across two schools once", () => {
    const resolved = dedupeRecipients([
      candidate({ email: "shared@trust.test", schoolId: "school-1" }),
      candidate({ email: "shared@trust.test", schoolId: "school-2" }),
    ]);
    assert.equal(resolved.emails.length, 1);
    assert.equal(resolved.recipientCount, 1);
  });

  it("dedupes ignoring case and surrounding whitespace", () => {
    const resolved = dedupeRecipients([
      candidate({ email: " Foo@Example.test " }),
      candidate({ email: "foo@example.test" }),
    ]);
    assert.equal(resolved.emails.length, 1);
    assert.equal(resolved.recipientCount, 1);
  });

  it("emails a member with no account but creates no notification for them", () => {
    const resolved = dedupeRecipients([
      candidate({ email: "no-account@school.test", profileId: null }),
    ]);
    assert.equal(resolved.emails.length, 1);
    assert.deepEqual(resolved.profileIds, []);
    assert.equal(resolved.recipientCount, 1);
  });

  it("notifies an owner who has an account but no address, without emailing them", () => {
    const resolved = dedupeRecipients([
      candidate({ email: null, profileId: "profile-9", source: "owner" }),
    ]);
    assert.deepEqual(resolved.emails, []);
    assert.deepEqual(resolved.profileIds, ["profile-9"]);
    assert.equal(resolved.recipientCount, 1);
  });

  it("drops the entry's contact address once the school has a member address", () => {
    const resolved = dedupeRecipients([
      candidate({ email: "member@school.test", source: "member" }),
      candidate({ email: "stale-contact@school.test", source: "contact" }),
    ]);
    assert.deepEqual(
      resolved.emails.map((e) => e.email),
      ["member@school.test"],
    );
    assert.equal(resolved.recipientCount, 1);
  });

  it("keeps the entry's contact address when the school has no member rows", () => {
    const resolved = dedupeRecipients([
      candidate({ email: null, profileId: "owner-1", source: "owner" }),
      candidate({ email: "only-contact@school.test", source: "contact" }),
    ]);
    assert.deepEqual(
      resolved.emails.map((e) => e.email),
      ["only-contact@school.test"],
    );
    // The owner (account, no address) and the contact (address, no account) are
    // two distinct people, so two recipients.
    assert.equal(resolved.recipientCount, 2);
  });

  it("keeps a contact address on one school while dropping it on another", () => {
    const resolved = dedupeRecipients([
      candidate({ email: "member@a.test", schoolId: "a", source: "member" }),
      candidate({ email: "contact@a.test", schoolId: "a", source: "contact" }),
      candidate({ email: "contact@b.test", schoolId: "b", source: "contact" }),
    ]);
    assert.deepEqual(
      resolved.emails.map((e) => e.email).sort(),
      ["contact@b.test", "member@a.test"],
    );
    assert.equal(resolved.recipientCount, 2);
  });

  it("never counts a synthetic student address, whatever path it arrives by", () => {
    const resolved = dedupeRecipients([
      candidate({ email: "student.ab12cd@students.adewaleconference.local", profileId: null }),
    ]);
    assert.deepEqual(resolved.emails, []);
    assert.equal(resolved.recipientCount, 0);
  });

  it("always reports a count that covers every address and every account", () => {
    // Invariant: nobody is silently lost. The count is at least as large as the
    // bigger of the two channel lists, and never larger than their sum.
    const rows = [
      candidate({ email: "a@x.test", profileId: "p1" }),
      candidate({ email: "b@x.test", profileId: null }),
      candidate({ email: null, profileId: "p2", source: "owner" }),
      candidate({ email: "a@x.test", profileId: "p1", source: "owner" }),
    ];
    const resolved = dedupeRecipients(rows);
    assert.ok(
      resolved.recipientCount >=
        Math.max(resolved.emails.length, resolved.profileIds.length),
      "count must cover the larger channel",
    );
    assert.ok(
      resolved.recipientCount <= resolved.emails.length + resolved.profileIds.length,
      "count must not exceed both channels combined",
    );
    assert.equal(resolved.recipientCount, 3);
  });
});
