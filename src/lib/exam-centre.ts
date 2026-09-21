import { ZONAL_FINALS_OPTIONS } from "@/lib/forms";

export type CentreSource = "allocated" | "requested" | "lga" | "none";

export type CentreRegistration = {
  qualification_zone: string | null;
  details: Record<string, string> | null;
  schools?: { lga: string | null } | null;
};

function detailsValue(details: Record<string, string> | null | undefined, key: string) {
  const value = details?.[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Is this zone one of the real exam centres, or a leftover LGA/division? */
export function isKnownCentre(zone: string) {
  return !zone || (ZONAL_FINALS_OPTIONS as readonly string[]).includes(zone);
}

/**
 * The school's own answer to the required "Select Location For Zonal Finals"
 * question. Earlier editions asked it under a different label — including its
 * trailing spaces, which are part of the stored key.
 */
export function requestedCentre(details: Record<string, string> | null | undefined) {
  return (
    detailsValue(details, "Zonal Finals Location") ||
    detailsValue(details, "Which center do you prefer for the Zonal Final Exam?  ")
  );
}

/**
 * Where a school sits the zonal exam, and — crucially — who decided it.
 *
 * Only `qualification_zone` is an admin allocation. Everything after it is a
 * fallback: the school's own request, then its LGA, which is not a centre at all.
 * Collapsing these into one string is what let saveQualificationDecision write an
 * LGA into the centre column on every score entry.
 */
export function examCentre(r: CentreRegistration): { value: string; source: CentreSource } {
  if (r.qualification_zone) return { value: r.qualification_zone, source: "allocated" };
  const requested = requestedCentre(r.details);
  if (requested) return { value: requested, source: "requested" };
  if (r.schools?.lga) return { value: r.schools.lga, source: "lga" };
  return { value: "Unassigned", source: "none" };
}
