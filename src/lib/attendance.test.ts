import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attendanceCounts,
  buildRoster,
  byExamNo,
  latestEventByStudent,
  markerName,
  matchesCandidate,
  pickRegistrationPerSchool,
  schoolCentres,
  type AttendanceMark,
  type RosterCandidate,
} from "./attendance";

// Fictional fixtures — this is a public repo, no real school or student names.
const ABEOKUTA = { id: "centre-abk", town: "Abeokuta", legacy_zone: "Abeokuta" };
// Iko Gateway replaced Idiroko, so its town and its stored zone differ.
const IKO = { id: "centre-iko", town: "Iko", legacy_zone: "Idiroko" };
// New for 2026: no legacy zone names it, but admins type the town by hand.
const IMEKO = { id: "centre-imeko", town: "Imeko", legacy_zone: null };
const CENTRES = [ABEOKUTA, IKO, IMEKO];

function candidate(over: Partial<RosterCandidate> = {}): RosterCandidate {
  return {
    studentId: "s1",
    examNo: "001",
    name: "Ada Nwosu",
    schoolId: "school-1",
    schoolName: "Riverbend Academy",
    level: "SS 2",
    ...over,
  };
}

describe("pickRegistrationPerSchool", () => {
  it("keeps the earliest registration when a school has more than one", () => {
    const rows = [
      { school_id: "a", qualification_zone: "Abeokuta", created_at: "2026-03-01" },
      { school_id: "a", qualification_zone: "Sagamu", created_at: "2026-01-01" },
      { school_id: "b", qualification_zone: "Ifo", created_at: "2026-02-01" },
    ];
    const picked = pickRegistrationPerSchool(rows);
    assert.equal(picked.size, 2);
    assert.equal(picked.get("a")?.qualification_zone, "Sagamu");
  });

  it("drops a registration with no school rather than keying it on null", () => {
    const picked = pickRegistrationPerSchool([
      { school_id: null, qualification_zone: "Abeokuta", created_at: "2026-01-01" },
    ]);
    assert.equal(picked.size, 0);
  });
});

describe("schoolCentres", () => {
  it("maps a stored town onto the venue that serves it", () => {
    const map = schoolCentres(
      [{ school_id: "a", qualification_zone: "Abeokuta", created_at: "2026-01-01" }],
      CENTRES,
    );
    assert.equal(map.get("a"), "centre-abk");
  });

  it("prefers an explicit exam_centre_id over the legacy town", () => {
    const map = schoolCentres(
      [
        {
          school_id: "a",
          qualification_zone: "Abeokuta",
          exam_centre_id: "centre-imeko",
          created_at: "2026-01-01",
        },
      ],
      CENTRES,
    );
    assert.equal(map.get("a"), "centre-imeko");
  });

  it("returns null for a zone no venue claims, so it reads as a gap not a guess", () => {
    const map = schoolCentres(
      [{ school_id: "a", qualification_zone: "Ilaro", created_at: "2026-01-01" }],
      CENTRES,
    );
    assert.equal(map.get("a"), null);
  });

  // The participants screen takes a free-text centre, so the stored string is
  // whatever an admin typed — for the two 2026 venues no legacy zone names,
  // that is the town. Six schools and 18 reps sat invisible to their lead.
  it("matches a venue by its town when no legacy zone names it", () => {
    const map = schoolCentres(
      [{ school_id: "a", qualification_zone: "Imeko", created_at: "2026-01-01" }],
      CENTRES,
    );
    assert.equal(map.get("a"), "centre-imeko");
  });

  it("still prefers the legacy zone, so Idiroko reaches Iko Gateway", () => {
    const map = schoolCentres(
      [{ school_id: "a", qualification_zone: "Idiroko", created_at: "2026-01-01" }],
      CENTRES,
    );
    assert.equal(map.get("a"), "centre-iko");
  });

  it("ignores the case and padding a human typed", () => {
    for (const typed of ["imeko", " Imeko ", "IMEKO"]) {
      const map = schoolCentres(
        [{ school_id: "a", qualification_zone: typed, created_at: "2026-01-01" }],
        CENTRES,
      );
      assert.equal(map.get("a"), "centre-imeko", `failed for ${JSON.stringify(typed)}`);
    }
  });

  it("returns null for an unallocated school", () => {
    const map = schoolCentres(
      [{ school_id: "a", qualification_zone: null, created_at: "2026-01-01" }],
      CENTRES,
    );
    assert.equal(map.get("a"), null);
  });
});

describe("buildRoster", () => {
  // Unpadded on purpose: the column is `^[0-9]{1,3}$`, and while
  // allocate_candidate_numbers lpads to three, older editions' mirrored values
  // do not. Padded numbers sort the same as text, so they would not catch this.
  const candidates = [
    candidate({ studentId: "s1", examNo: "7", name: "Ada Nwosu" }),
    candidate({ studentId: "s2", examNo: "100", name: "Bimpe Okoro" }),
    candidate({ studentId: "s3", examNo: "42", name: "Chidi Bello" }),
  ];

  it("orders by candidate number numerically, not as text", () => {
    const roster = buildRoster(candidates, []);
    assert.deepEqual(
      roster.map((r) => r.examNo),
      ["7", "42", "100"],
    );
  });

  it("leaves an unmarked candidate unmarked rather than absent", () => {
    const roster = buildRoster(candidates, []);
    assert.ok(roster.every((r) => r.state === "unmarked"));
    assert.ok(roster.every((r) => r.markedAt === null));
  });

  it("carries the centre a mark was made at, which can differ from the roster", () => {
    const marks: AttendanceMark[] = [
      { student_id: "s2", status: "present", centre_id: "centre-arg", marked_at: "2026-09-23T07:10:00Z" },
    ];
    const roster = buildRoster(candidates, marks);
    const bimpe = roster.find((r) => r.studentId === "s2");
    assert.equal(bimpe?.state, "present");
    assert.equal(bimpe?.markedAtCentreId, "centre-arg");
  });

  it("ignores a mark for somebody not on this roster", () => {
    const roster = buildRoster(candidates, [
      { student_id: "ghost", status: "present", centre_id: "centre-abk", marked_at: "2026-09-23T07:00:00Z" },
    ]);
    assert.equal(roster.length, 3);
    assert.ok(roster.every((r) => r.state === "unmarked"));
  });
});

describe("attendanceCounts", () => {
  it("counts each state and totals them", () => {
    const counts = attendanceCounts([
      { state: "present" },
      { state: "present" },
      { state: "absent" },
      { state: "unmarked" },
    ]);
    assert.deepEqual(counts, { present: 2, absent: 1, unmarked: 1, total: 4 });
  });

  it("reports zeroes for an empty centre rather than throwing", () => {
    assert.deepEqual(attendanceCounts([]), { present: 0, absent: 0, unmarked: 0, total: 0 });
  });
});

describe("matchesCandidate", () => {
  const ada = candidate({ examNo: "042", name: "Ada Nwosu", schoolName: "Riverbend Academy" });

  it("matches everything on an empty query", () => {
    assert.equal(matchesCandidate(ada, "   "), true);
  });

  it("matches a bare number against the candidate number only", () => {
    assert.equal(matchesCandidate(ada, "42"), true);
    assert.equal(matchesCandidate(ada, "042"), true);
    // Riverbend has no 7 in it either way; the point is that a numeric query
    // never falls through to the name/school haystack.
    assert.equal(matchesCandidate(candidate({ examNo: "007", schoolName: "42 Academy" }), "42"), false);
  });

  it("matches name and school tokens in any order", () => {
    assert.equal(matchesCandidate(ada, "nwosu ada"), true);
    assert.equal(matchesCandidate(ada, "riverbend"), true);
    assert.equal(matchesCandidate(ada, "bimpe"), false);
  });
});

describe("latestEventByStudent", () => {
  const rows = [
    { student_id: "s1", at: "2026-09-23T08:02:00Z" },
    { student_id: "s1", at: "2026-09-23T11:40:00Z" },
    { student_id: "s2", at: "2026-09-23T09:00:00Z" },
  ];

  it("keeps the newest mark per student whatever order the rows arrive in", () => {
    assert.equal(latestEventByStudent(rows).get("s1")?.at, "2026-09-23T11:40:00Z");
    assert.equal(latestEventByStudent([...rows].reverse()).get("s1")?.at, "2026-09-23T11:40:00Z");
  });

  it("keeps every student, not just the busiest", () => {
    assert.equal(latestEventByStudent(rows).size, 2);
  });
});

describe("markerName", () => {
  const base = { student_id: "s1", at: "2026-09-23T08:00:00Z" };

  it("names the centre lead who marked", () => {
    assert.equal(
      markerName({ ...base, centre_leads: { name: "Tunde Bello" }, profiles: null }),
      "Tunde Bello",
    );
  });

  it("falls back to an admin's name, then their email, then a role", () => {
    assert.equal(
      markerName({ ...base, centre_leads: null, profiles: { full_name: "Desk Admin", email: "a@b.c" } }),
      "Desk Admin",
    );
    assert.equal(
      markerName({ ...base, centre_leads: null, profiles: { full_name: null, email: "a@b.c" } }),
      "a@b.c",
    );
    assert.equal(
      markerName({ ...base, centre_leads: null, profiles: { full_name: null, email: null } }),
      "an admin",
    );
  });

  it("says nothing for a candidate nobody has marked", () => {
    assert.equal(markerName(undefined), "");
  });
});

describe("byExamNo", () => {
  it("falls back to name when two candidates share a number", () => {
    const a = candidate({ examNo: "005", name: "Ada" });
    const z = candidate({ examNo: "005", name: "Zainab" });
    assert.ok(byExamNo(a, z) < 0);
  });
});
