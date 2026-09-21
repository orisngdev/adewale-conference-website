import test from "node:test";
import assert from "node:assert/strict";
import { examCentre, isKnownCentre, requestedCentre } from "@/lib/exam-centre";

test("requestedCentre", async (t) => {
  await t.test("reads the current question", () => {
    assert.equal(requestedCentre({ "Zonal Finals Location": "Ilaro" }), "Ilaro");
  });

  await t.test("falls back to the earlier edition's question, trailing spaces and all", () => {
    assert.equal(
      requestedCentre({ "Which center do you prefer for the Zonal Final Exam?  ": "Sagamu" }),
      "Sagamu",
    );
  });

  await t.test("is blank when unanswered", () => {
    assert.equal(requestedCentre({}), "");
    assert.equal(requestedCentre(null), "");
    assert.equal(requestedCentre({ "Zonal Finals Location": "  " }), "");
  });
});

test("examCentre", async (t) => {
  const details = { "Zonal Finals Location": "Ilaro" };

  await t.test("an admin allocation outranks the school's request", () => {
    assert.deepEqual(examCentre({ qualification_zone: "Ota", details, schools: null }), {
      value: "Ota",
      source: "allocated",
    });
  });

  await t.test("falls back to the request, then the LGA", () => {
    assert.deepEqual(examCentre({ qualification_zone: null, details, schools: { lga: "Ifo" } }), {
      value: "Ilaro",
      source: "requested",
    });
    assert.deepEqual(
      examCentre({ qualification_zone: null, details: {}, schools: { lga: "Ifo" } }),
      { value: "Ifo", source: "lga" },
    );
    assert.deepEqual(examCentre({ qualification_zone: null, details: {}, schools: null }), {
      value: "Unassigned",
      source: "none",
    });
  });
});

test("isKnownCentre separates real centres from the LGAs that corrupted the column", () => {
  assert.equal(isKnownCentre("Ijebu Ode"), true);
  assert.equal(isKnownCentre(""), true);
  assert.equal(isKnownCentre("Yewa South"), false);
});
