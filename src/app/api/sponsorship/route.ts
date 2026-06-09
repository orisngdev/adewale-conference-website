import { NextResponse } from "next/server";
import {
  createAirtableRecord,
  getSponsorshipTableId,
} from "@/lib/airtable";
import {
  initialSponsorshipFormData,
  SPONSORSHIP_TIER_OPTIONS,
  type SponsorshipFormData,
} from "@/lib/forms";
import { buildSponsorshipEmail, sendEmailSafely } from "@/lib/email";

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

function optionalString(value: unknown, fieldName: string, maxLength = 2000) {
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

function requirePhone(value: unknown, fieldName: string) {
  const phone = requireString(value, fieldName, 30);
  if (phone.replace(/\D/g, "").length < 7) {
    throw new ValidationError(`${fieldName} must be a valid phone number.`);
  }

  return phone;
}

function requireTier(value: unknown) {
  const tier = requireString(value, "Sponsorship Tier Of Interest");
  if (!SPONSORSHIP_TIER_OPTIONS.includes(tier as (typeof SPONSORSHIP_TIER_OPTIONS)[number])) {
    throw new ValidationError("Sponsorship Tier Of Interest is invalid.");
  }

  return tier as SponsorshipFormData["tier"];
}

function sanitizeSponsorshipPayload(payload: unknown): SponsorshipFormData {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ValidationError("Invalid sponsorship payload.");
  }

  const data = payload as Record<string, unknown>;

  return {
    ...initialSponsorshipFormData,
    org: requireString(data.org, "Organisation Name"),
    contact: requireString(data.contact, "Contact Person"),
    email: requireEmail(data.email, "Email Address"),
    phone: requirePhone(data.phone, "Phone Number"),
    tier: requireTier(data.tier),
    message: optionalString(data.message, "Message"),
  };
}

function mapSponsorshipFields(data: SponsorshipFormData) {
  return {
    "Organisation Name": data.org,
    "Contact Person": data.contact,
    "Email Address": data.email,
    "Phone Number": data.phone,
    "Sponsorship Tier Of Interest": data.tier,
    Message: data.message,
  };
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const sponsorship = sanitizeSponsorshipPayload(payload);

    await createAirtableRecord(
      getSponsorshipTableId(),
      mapSponsorshipFields(sponsorship),
    );

    await sendEmailSafely(
      buildSponsorshipEmail({
        org: sponsorship.org,
        contact: sponsorship.contact,
        email: sponsorship.email,
        tier: sponsorship.tier,
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

    if (error instanceof Error) {
      if (error.message.startsWith("INVALID_")) {
        return badRequest(error.message);
      }

      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    console.error("Sponsorship submission failed:", error);
    return NextResponse.json(
      { error: "Unable to send sponsorship enquiry right now." },
      { status: 500 },
    );
  }
}
