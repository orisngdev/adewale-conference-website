import test from "node:test";
import assert from "node:assert/strict";
import {
  REGISTRATION_EXPORT_HEADERS,
  registrationExportMatrix,
  type RegistrationExportRow,
} from "@/lib/registration-export";

function row(over: Partial<RegistrationExportRow> = {}): RegistrationExportRow {
  return {
    edition_year: 2026,
    status: "approved",
    contact_email: "coordinator@riverbank.example",
    contact_name: "A. Coordinator",
    reps: [{ name: "Rep One", level: "SS2" }],
    details: { "Zonal Finals Location": "Ilaro" },
    qualification_zone: null,
    schools: { name: "Riverbank College", lga: "Yewa South" },
    profiles: null,
    ...over,
  };
}

const cell = (matrix: (string | number | null | undefined)[][], header: string) =>
  matrix[1][REGISTRATION_EXPORT_HEADERS.indexOf(header)];

test("registrationExportMatrix", async (t) => {
  await t.test("carries the centre the school selected", () => {
    const matrix = registrationExportMatrix([row()]);
    assert.equal(cell(matrix, "Centre selected"), "Ilaro");
  });

  await t.test("reports the admin allocation when it differs from the request", () => {
    const matrix = registrationExportMatrix([row({ qualification_zone: "Ota" })]);
    assert.equal(cell(matrix, "Exam centre"), "Ota");
    assert.equal(cell(matrix, "Centre selected"), "Ilaro");
  });

  await t.test("reads the older edition's centre question", () => {
    const matrix = registrationExportMatrix([
      row({
        details: { "Which center do you prefer for the Zonal Final Exam?  ": "Sagamu" },
      }),
    ]);
    assert.equal(cell(matrix, "Centre selected"), "Sagamu");
  });

  await t.test("leaves the centre blank rather than falling back to the LGA", () => {
    const matrix = registrationExportMatrix([row({ details: {} })]);
    assert.equal(cell(matrix, "Exam centre"), "");
    assert.equal(cell(matrix, "Centre selected"), "");
  });

  await t.test("still reports school, reps and age", () => {
    const matrix = registrationExportMatrix([
      row({ details: { "Student Rep 1 DOB": "2010-01-01" } }),
    ]);
    assert.equal(cell(matrix, "School"), "Riverbank College");
    assert.equal(cell(matrix, "Rep 1 name"), "Rep One");
    assert.equal(typeof cell(matrix, "Rep 1 age"), "number");
  });
});
