import { NextResponse } from "next/server";
import {
  deriveBatch,
  FELLOW_CENTRE_OPTIONS,
  FELLOW_COMMITMENTS,
  FELLOW_DECLARATIONS,
  FELLOW_GENDER_OPTIONS,
  FELLOW_ROLE_OPTIONS,
  FELLOW_SCENARIOS,
  initialFellowFormData,
  mapFellowFields,
  PPA_LGA_OPTIONS,
  toSheetRow,
  type FellowFormData,
} from "@/lib/fellows";
import { scoreScenarios } from "@/lib/fellows-scoring";
import { appendFellowRow, isFellowsSheetConfigured } from "@/lib/fellows-sheet";
import { YES_NO_OPTIONS } from "@/lib/forms";
import {
  buildAdminNewFellowEmail,
  buildFellowApplicationEmail,
  getNotifyRecipients,
  sendEmailSafely,
} from "@/lib/email";
import { FELLOWS_EVENT_DATE } from "@/lib/fellows-programme";
import { rateLimit, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class ValidationError extends Error {}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function requireString(value: unknown, fieldName: string, maxLength = 200) {
  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw new ValidationError(`${fieldName} is too long.`);
  }

  return trimmed;
}

function requireEmail(value: unknown, fieldName: string) {
  const email = requireString(value, fieldName, 320).toLowerCase();
  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError(`${fieldName} must be a valid email address.`);
  }

  return email;
}

function requireOneOf(value: unknown, fieldName: string, options: readonly string[]) {
  const answer = requireString(value, fieldName);
  if (!options.includes(answer)) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }

  return answer;
}

/** A checkbox group where every box is mandatory — the commitment block and the
 *  declaration. Both exist to be an explicit promise, so a partial tick is not a
 *  weaker promise, it is no promise. */
function requireAllChecked(value: unknown, fieldName: string, options: readonly string[]) {
  const checked = requireSomeOf(value, fieldName, options);
  if (checked.length !== options.length) {
    throw new ValidationError(`${fieldName} must all be confirmed.`);
  }

  return checked;
}

/** A checkbox group needing at least one box. */
function requireSomeOf(value: unknown, fieldName: string, options: readonly string[]) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError(`${fieldName} is required.`);
  }

  const checked = [...new Set(value)];
  for (const entry of checked) {
    if (typeof entry !== "string" || !options.includes(entry)) {
      throw new ValidationError(`${fieldName} is invalid.`);
    }
  }

  return checked as string[];
}

function sanitizeFellowPayload(payload: unknown): FellowFormData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Invalid application payload.");
  }

  const data = payload as Record<string, unknown>;

  return {
    ...initialFellowFormData,
    fullName: requireString(data.fullName, "Full name", 120),
    // Free text on purpose: Nigerian numbers arrive as 0803…, +234 803… and
    // 234-803…, and a format check rejects real applicants over punctuation.
    phone: requireString(data.phone, "Phone number", 40),
    email: requireEmail(data.email, "Email address"),
    gender: requireOneOf(data.gender, "Gender", FELLOW_GENDER_OPTIONS),
    stateCode: requireString(data.stateCode, "NYSC state code", 40),
    ppa: requireString(data.ppa, "Place of Primary Assignment", 200),
    ppaIsSecondarySchool: requireOneOf(
      data.ppaIsSecondarySchool,
      "Whether your PPA is a secondary school",
      YES_NO_OPTIONS,
    ),
    ppaLga: requireOneOf(data.ppaLga, "LGA of your PPA", PPA_LGA_OPTIONS),
    courseOfStudy: requireString(data.courseOfStudy, "Course of study", 120),
    commitments: requireAllChecked(data.commitments, "The commitments", FELLOW_COMMITMENTS),
    preferredCentre: requireOneOf(data.preferredCentre, "Preferred centre", FELLOW_CENTRE_OPTIONS),
    acceptsAnotherCentre: requireOneOf(
      data.acceptsAnotherCentre,
      "Whether you would accept another centre",
      YES_NO_OPTIONS,
    ),
    roles: requireSomeOf(data.roles, "Roles that interest you", FELLOW_ROLE_OPTIONS),
    invigilatedBefore: requireOneOf(
      data.invigilatedBefore,
      "Whether you have invigilated before",
      YES_NO_OPTIONS,
    ),
    scenario1: requireOneOf(
      data.scenario1,
      "The first question",
      FELLOW_SCENARIOS[0].options.map((option) => option.id),
    ),
    scenario2: requireOneOf(
      data.scenario2,
      "The second question",
      FELLOW_SCENARIOS[1].options.map((option) => option.id),
    ),
    declarations: requireAllChecked(data.declarations, "The declaration", FELLOW_DECLARATIONS),
  };
}

export async function POST(request: Request) {
  try {
    if (!rateLimit(`fellows:${requestIp(request.headers)}`, { limit: 5, windowMs: 60_000 })) {
      return NextResponse.json(
        { error: "Too many applications from this device. Please wait a minute and try again." },
        { status: 429 },
      );
    }

    const payload = await request.json();
    const application = sanitizeFellowPayload(payload);

    if (!isFellowsSheetConfigured()) {
      console.error("Fellows sheet webhook is not configured; cannot accept applications.");
      return NextResponse.json(
        { error: "Applications are not open yet. Please try again shortly." },
        { status: 503 },
      );
    }

    const scenario = scoreScenarios(application);
    const fields = mapFellowFields(application, {
      submittedAt: new Date().toISOString(),
      scenarioScore: scenario.score,
      scenarioOutOf: scenario.outOf,
    });

    const notifyRecipients = getNotifyRecipients();
    const emailData = {
      fullName: application.fullName,
      email: application.email,
      phone: application.phone,
      stateCode: application.stateCode,
      batch: deriveBatch(application.stateCode),
      ppa: application.ppa,
      ppaLga: application.ppaLga,
      preferredCentre: application.preferredCentre,
      roles: application.roles.join(", "),
      scenarioScore: `${scenario.score}/${scenario.outOf}`,
      eventDate: FELLOWS_EVENT_DATE,
    };

    try {
      await appendFellowRow(toSheetRow(fields));
    } catch (sheetError) {
      // The sheet is the only store, so a failed write would otherwise lose the
      // application entirely. Mail the team the full details flagged as unsaved,
      // then tell the applicant to retry — a duplicate row is cheap, a lost
      // application is not, and duplicates are deduped on state code anyway.
      const message = sheetError instanceof Error ? sheetError.message : "Unknown error";
      console.error("Fellows sheet write failed:", sheetError);

      if (notifyRecipients.length > 0) {
        await sendEmailSafely(
          buildAdminNewFellowEmail({
            ...emailData,
            recipients: notifyRecipients,
            sheetFailed: message,
          }),
        );
      }

      return NextResponse.json(
        {
          error:
            "We could not save your application just now. Please submit it once more — if it fails again, our team has already been alerted.",
        },
        { status: 502 },
      );
    }

    await sendEmailSafely(buildFellowApplicationEmail(emailData));

    if (notifyRecipients.length > 0) {
      await sendEmailSafely(
        buildAdminNewFellowEmail({ ...emailData, recipients: notifyRecipients }),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("Invalid JSON payload.");
    }

    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    if (error instanceof Error && process.env.NODE_ENV !== "production") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.error("Fellows application failed:", error);
    return NextResponse.json(
      { error: "Unable to submit your application right now." },
      { status: 500 },
    );
  }
}
