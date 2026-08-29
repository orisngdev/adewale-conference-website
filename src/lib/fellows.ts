import { LGA_OPTIONS, ZONAL_CENTRE_2026_OPTIONS } from "./forms";

/**
 * The Adéwálé Fellows application — the one description of its shape.
 *
 * Shared by the client modal, the API route and the sheet writer, so a field
 * cannot be collected without being validated or written. Deliberately holds no
 * answer key: the two scenario questions carry their options here but their
 * correct answers live in `fellows-scoring.ts`, which is server-only, so nothing
 * an applicant could read tells them what to pick.
 */

export const FELLOW_GENDER_OPTIONS = [
  "Female",
  "Male",
  "Prefer not to say",
] as const;

// Where the applicant is based, which is what drives centre allocation. Needs an
// escape hatch the registration form's LGA list does not: someone outside Ogun
// State can still apply, and we would rather know that than have them pick a
// wrong LGA to get past the question.
export const PPA_LGA_OPTIONS = [
  ...LGA_OPTIONS,
  "I am not based in Ogun State",
] as const;

export const FELLOW_ROLE_OPTIONS = [
  "Centre Lead",
  "Invigilator",
  "Registration & Materials Officer",
] as const;

export const FELLOW_CENTRE_OPTIONS = ZONAL_CENTRE_2026_OPTIONS;

// All three must be ticked. Merged from what were two separate screening
// questions — as one block it reads as a commitment being made rather than an
// availability interrogation, and there is no half-answer to interpret.
export const FELLOW_COMMITMENTS = [
  "I am available all day on Wednesday, 23 September 2026 (6:30am – 4:00pm).",
  "I can attend the online training session in the week before.",
  "I can attend the in-person training session in the week before.",
] as const;

export const FELLOW_DECLARATIONS = [
  "The information I have given is true and accurate.",
  "I understand that any breach of examination integrity means immediate removal, and a report to NYSC if I am a serving corps member.",
  "If selected, I will attend both training sessions and be present for the whole of examination day.",
] as const;

/** Judgement questions, scored server-side. Option ids are stable so the key in
 *  `fellows-scoring.ts` survives any reordering of the labels here. */
export const FELLOW_SCENARIOS = [
  {
    id: "scenario1",
    prompt:
      "Twenty minutes before the end of the examination, a candidate finishes and asks to leave the hall. What do you do?",
    options: [
      { id: "a", label: "Allow the candidate to leave quietly so as not to disturb others" },
      { id: "b", label: "Ask the candidate to remain seated until the end, and collect all scripts together" },
      { id: "c", label: "Collect the script and let the candidate go, after warning them not to speak to anyone" },
      { id: "d", label: "Send the candidate to the school principal to decide" },
    ],
  },
  {
    id: "scenario2",
    prompt:
      "You notice two candidates at the back of the hall exchanging glances, and one of them adjusting a paper on the desk. What is your first action?",
    options: [
      { id: "a", label: "Announce to the whole hall that anyone caught cheating will be disqualified" },
      { id: "b", label: "Move quietly to that part of the hall and continue observing from close by" },
      { id: "c", label: "Seize both scripts immediately and remove the candidates from the hall" },
      { id: "d", label: "Say nothing during the examination and report it in your end-of-day report" },
    ],
  },
] as const;

export type ScenarioId = (typeof FELLOW_SCENARIOS)[number]["id"];

export const initialFellowFormData = {
  fullName: "",
  phone: "",
  email: "",
  gender: "",
  stateCode: "",
  ppa: "",
  ppaIsSecondarySchool: "",
  ppaLga: "",
  courseOfStudy: "",
  commitments: [] as string[],
  preferredCentre: "",
  acceptsAnotherCentre: "",
  roles: [] as string[],
  invigilatedBefore: "",
  scenario1: "",
  scenario2: "",
  declarations: [] as string[],
};

export type FellowFormData = typeof initialFellowFormData;

/**
 * Reads the service batch out of a state code (`OG/26A/1234` → `Batch A 2026`).
 *
 * The batch is asked for on paper forms, but it is already inside the code, and
 * two fields that must agree are two fields that can disagree. Returns "" when
 * the code is not in the standard shape — a blank cell is more honest than a
 * guessed batch.
 */
export function deriveBatch(stateCode: string) {
  const match = stateCode.match(/\/\s*(\d{2})\s*([A-C])\b/i);
  if (!match) return "";
  return `Batch ${match[2].toUpperCase()} 20${match[1]}`;
}

/**
 * The spreadsheet's columns, in order.
 *
 * One list drives both the header row in `docs/fellows-sheet-setup.md` and the
 * array the Apps Script appends, so the two cannot drift into writing values
 * under the wrong headings. The team's own review columns (Status, Interview
 * score, Assigned centre) sit to the right of these and are never written here.
 */
export const FELLOW_SHEET_COLUMNS = [
  "Timestamp",
  "Full name",
  "Phone",
  "Email",
  "Gender",
  "State code (if serving)",
  "Batch (derived)",
  "PPA (if serving)",
  "PPA is a secondary school",
  "Local Government Area",
  "Course of study",
  "Commitment confirmed",
  "Preferred centre",
  "Accepts another centre",
  "Roles",
  "Invigilated before",
  "Scenario 1",
  "Scenario 2",
  "Scenario score",
  "Declaration",
] as const;

export type FellowSheetColumn = (typeof FELLOW_SHEET_COLUMNS)[number];

/** Renders a scenario answer as "b — Move quietly to…", so the sheet is readable
 *  without cross-referencing the option ids. */
function scenarioAnswerLabel(scenarioId: ScenarioId, answerId: string) {
  const scenario = FELLOW_SCENARIOS.find((s) => s.id === scenarioId);
  const option = scenario?.options.find((o) => o.id === answerId);
  return option ? `${option.id} — ${option.label}` : "";
}

export function mapFellowFields(
  data: FellowFormData,
  meta: { submittedAt: string; scenarioScore: number; scenarioOutOf: number },
): Record<FellowSheetColumn, string> {
  return {
    Timestamp: meta.submittedAt,
    "Full name": data.fullName,
    Phone: data.phone,
    Email: data.email,
    Gender: data.gender,
    "State code (if serving)": data.stateCode,
    "Batch (derived)": deriveBatch(data.stateCode),
    "PPA (if serving)": data.ppa,
    "PPA is a secondary school": data.ppaIsSecondarySchool,
    "Local Government Area": data.ppaLga,
    "Course of study": data.courseOfStudy,
    "Commitment confirmed": data.commitments.length === FELLOW_COMMITMENTS.length ? "Yes" : "No",
    "Preferred centre": data.preferredCentre,
    "Accepts another centre": data.acceptsAnotherCentre,
    Roles: data.roles.join(", "),
    "Invigilated before": data.invigilatedBefore,
    "Scenario 1": scenarioAnswerLabel("scenario1", data.scenario1),
    "Scenario 2": scenarioAnswerLabel("scenario2", data.scenario2),
    "Scenario score": `${meta.scenarioScore}/${meta.scenarioOutOf}`,
    Declaration: data.declarations.length === FELLOW_DECLARATIONS.length ? "Confirmed" : "Incomplete",
  };
}

/** Flattens the mapped fields into the row the Apps Script appends. */
export function toSheetRow(fields: Record<FellowSheetColumn, string>) {
  return FELLOW_SHEET_COLUMNS.map((column) => fields[column] ?? "");
}
