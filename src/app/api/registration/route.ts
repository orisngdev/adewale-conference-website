import { NextResponse } from "next/server";
import {
  createAirtableRecord,
  getParticipantsTableId,
  getSchoolDatabaseTableId,
  findSchoolByNameCategoryLga,
} from "@/lib/airtable";
import {
  CLASS_OPTIONS,
  GENDER_OPTIONS,
  LGA_OPTIONS,
  type RegistrationFormData,
  SCHOOL_CATEGORY_OPTIONS,
  YES_NO_OPTIONS,
  ZONAL_FINALS_OPTIONS,
} from "@/lib/forms";
import { buildRegistrationEmail, sendEmailSafely } from "@/lib/email";

export const runtime = "nodejs";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const SCHOOL_SOURCE_OPTIONS = ["existing", "new"] as const;

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

function optionalString(value: unknown, fieldName: string, maxLength = 500) {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} is invalid.`);
  }

  const trimmed = value.trim();
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

function optionalEmail(value: unknown, fieldName: string) {
  const email = optionalString(value, fieldName, 320).toLowerCase();
  if (!email) {
    return "";
  }

  if (!EMAIL_REGEX.test(email)) {
    throw new ValidationError(`${fieldName} must be a valid email address.`);
  }

  return email;
}

function requirePhone(value: unknown, fieldName: string) {
  const phone = requireString(value, fieldName, 30);
  if (phone.replace(/\D/g, "").length < 7) {
    throw new ValidationError(`${fieldName} must be a valid phone number.`);
  }

  return phone;
}

function requireDate(value: unknown, fieldName: string) {
  const date = requireString(value, fieldName, 10);
  if (!DATE_REGEX.test(date)) {
    throw new ValidationError(`${fieldName} must be a valid date.`);
  }

  return date;
}

function requireOption<T extends readonly string[]>(
  value: unknown,
  options: T,
  fieldName: string,
): T[number] {
  const option = requireString(value, fieldName);
  if (!options.includes(option)) {
    throw new ValidationError(`${fieldName} is invalid.`);
  }

  return option as T[number];
}

function normalizeSchoolName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function sanitizeRegistrationPayload(payload: unknown): RegistrationFormData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Invalid registration payload.");
  }

  const data = payload as Record<string, unknown>;

  return {
    studentRep1FullName: requireString(data.studentRep1FullName, "Student Rep 1 Full Name"),
    studentRep1DOB: requireDate(data.studentRep1DOB, "Student Rep 1 DOB"),
    studentRep1Gender: requireOption(data.studentRep1Gender, GENDER_OPTIONS, "Student Rep 1 Gender"),
    studentRep1Class: requireOption(data.studentRep1Class, CLASS_OPTIONS, "Student Rep 1 Class"),
    studentRep1GuardianName: requireString(data.studentRep1GuardianName, "Student Rep 1 Guardian Name"),
    studentRep1GuardianNumber: requirePhone(data.studentRep1GuardianNumber, "Student Rep 1 Guardian Number"),
    studentRep2FullName: requireString(data.studentRep2FullName, "Student Rep 2 Full Name"),
    studentRep2DOB: requireDate(data.studentRep2DOB, "Student Rep 2 DOB"),
    studentRep2Gender: requireOption(data.studentRep2Gender, GENDER_OPTIONS, "Student Rep 2 Gender"),
    studentRep2Class: requireOption(data.studentRep2Class, CLASS_OPTIONS, "Student Rep 2 Class"),
    studentRep2GuardianName: requireString(data.studentRep2GuardianName, "Student Rep 2 Guardian Name"),
    studentRep2GuardianNumber: requirePhone(data.studentRep2GuardianNumber, "Student Rep 2 Guardian Number"),
    studentRep3FullName: requireString(data.studentRep3FullName, "Student Rep 3 Full Name"),
    studentRep3DOB: requireDate(data.studentRep3DOB, "Student Rep 3 DOB"),
    studentRep3Gender: requireOption(data.studentRep3Gender, GENDER_OPTIONS, "Student Rep 3 Gender"),
    studentRep3Class: requireOption(data.studentRep3Class, CLASS_OPTIONS, "Student Rep 3 Class"),
    studentRep3GuardianName: requireString(data.studentRep3GuardianName, "Student Rep 3 Guardian Name"),
    studentRep3GuardianNumber: requirePhone(data.studentRep3GuardianNumber, "Student Rep 3 Guardian Number"),
    schoolLGA: requireOption(data.schoolLGA, LGA_OPTIONS, "School LGA"),
    schoolCategory: requireOption(data.schoolCategory, SCHOOL_CATEGORY_OPTIONS, "School Category"),
    schoolSource: requireOption(data.schoolSource, SCHOOL_SOURCE_OPTIONS, "School Source"),
    schoolFullName: normalizeSchoolName(
      requireString(data.schoolFullName, "School Full Name"),
    ),
    schoolAddress: requireString(data.schoolAddress, "School Address", 300),
    schoolEmail: optionalEmail(data.schoolEmail, "School Email"),
    hearAboutAdewale: requireString(data.hearAboutAdewale, "Hear About Adewale", 300),
    zonalFinalsLocation: requireOption(
      data.zonalFinalsLocation,
      ZONAL_FINALS_OPTIONS,
      "Zonal Finals Location",
    ),
    principalFullName: requireString(data.principalFullName, "Principal Full Name"),
    principalGender: requireOption(data.principalGender, GENDER_OPTIONS, "Principal Gender"),
    principalNumber: requirePhone(data.principalNumber, "Principal Number"),
    principalEmail: requireEmail(data.principalEmail, "Principal Email Address"),
    teacherFullName: requireString(data.teacherFullName, "Teacher Full Name"),
    teacherGender: requireOption(data.teacherGender, GENDER_OPTIONS, "Teacher Gender"),
    teacherNumber: requirePhone(data.teacherNumber, "Teacher Number"),
    teacherEmail: requireEmail(data.teacherEmail, "Teacher Email Address"),
    participatedLastEdition: requireOption(
      data.participatedLastEdition,
      YES_NO_OPTIONS,
      "School Participated In Last Edition",
    ),
    likesAboutLastEdition: optionalString(data.likesAboutLastEdition, "Likes About Last Edition"),
    expectationFromLastEdition: optionalString(
      data.expectationFromLastEdition,
      "Expectation From Last Edition",
    ),
  };
}

function mapRegistrationFields(data: RegistrationFormData) {
  return {
    "Student Rep 1 Full Name": data.studentRep1FullName,
    "Student Rep 1 DOB": data.studentRep1DOB,
    "Student Rep 1 Gender": data.studentRep1Gender,
    "Student Rep 1 Class": data.studentRep1Class,
    "Student Rep 1 Guardian Name": data.studentRep1GuardianName,
    "Student Rep 1 Guardian Number": data.studentRep1GuardianNumber,
    "Student Rep 2 Full Name": data.studentRep2FullName,
    "Student Rep 2 DOB": data.studentRep2DOB,
    "Student Rep 2 Gender": data.studentRep2Gender,
    "Student Rep 2 Class": data.studentRep2Class,
    "Student Rep 2 Guardian Name": data.studentRep2GuardianName,
    "Student Rep 2 Guardian Number": data.studentRep2GuardianNumber,
    "Student Rep 3 Full Name": data.studentRep3FullName,
    "Student Rep 3 DOB": data.studentRep3DOB,
    "Student Rep 3 Gender": data.studentRep3Gender,
    "Student Rep 3 Class": data.studentRep3Class,
    "Student Rep 3 Guardian Name": data.studentRep3GuardianName,
    "Student Rep 3 Guardian Number": data.studentRep3GuardianNumber,
    "School LGA": data.schoolLGA,
    "School Category": data.schoolCategory,
    "School Full Name": data.schoolFullName,
    "School Address": data.schoolAddress,
    "School Email Address": data.schoolEmail,
    "Hear About Adewale": data.hearAboutAdewale,
    "Zonal Finals Location": data.zonalFinalsLocation,
    "Principal Full Name": data.principalFullName,
    "Principal Gender": data.principalGender,
    "Principal Number": data.principalNumber,
    "Principal Email Address": data.principalEmail,
    "Teacher Full Name": data.teacherFullName,
    "Teacher Gender": data.teacherGender,
    "Teacher Number": data.teacherNumber,
    "Teacher Email Address": data.teacherEmail,
    "School Participated In Last Edition": data.participatedLastEdition,
    "Likes About Last Edition": data.likesAboutLastEdition,
    "Expectation From Last Edition": data.expectationFromLastEdition,
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const registration = sanitizeRegistrationPayload(payload);

    if (registration.schoolSource === "new") {
      const schoolsTableId = getSchoolDatabaseTableId();
      const existingSchool = await findSchoolByNameCategoryLga(
        schoolsTableId,
        registration.schoolFullName,
        registration.schoolCategory,
        registration.schoolLGA,
      );

      if (!existingSchool) {
        await createAirtableRecord(schoolsTableId, {
          "School Name": registration.schoolFullName,
          "School Category": registration.schoolCategory,
          "School Local Government Area": registration.schoolLGA,
          "School Address": registration.schoolAddress,
          ...(registration.schoolEmail
            ? { "School Email": registration.schoolEmail }
            : {}),
        });
      }
    }

    await createAirtableRecord(
      getParticipantsTableId(),
      mapRegistrationFields(registration),
    );

    await sendEmailSafely(
      buildRegistrationEmail({
        schoolFullName: registration.schoolFullName,
        schoolLGA: registration.schoolLGA,
        zonalFinalsLocation: registration.zonalFinalsLocation,
        principalFullName: registration.principalFullName,
        principalEmail: registration.principalEmail,
        teacherFullName: registration.teacherFullName,
        teacherEmail: registration.teacherEmail,
      }),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return badRequest("Invalid JSON payload.");
    }

    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    console.error("Registration submission failed:", error);
    return NextResponse.json(
      { error: "Unable to submit registration right now." },
      { status: 500 },
    );
  }
}
