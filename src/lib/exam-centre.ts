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

/**
 * Which venue a registration sits at, as an `exam_centres` id.
 *
 * Deliberately stricter than examCentre() above: only an explicit allocation
 * counts, because a lead marking a register needs the students who were sent to
 * their hall, not the ones whose LGA happens to share a name with it. Null means
 * "no lead can see this school" and is a thing to fix, not a fallback.
 *
 * The zone is free text an admin typed, so it is matched case-insensitively
 * against the legacy zone FIRST and the town second. Order matters: Iko Gateway
 * replaced Idiroko, so it stores 'Idiroko' and sits in the town of Iko, and only
 * the legacy zone must win for it. The town rung is what reaches Arigbajo and
 * Imeko, which are new for 2026 and have no legacy zone at all.
 */
export function resolveCentreId(
  r: { qualification_zone: string | null; exam_centre_id?: string | null },
  centres: { id: string; town?: string | null; legacy_zone: string | null }[],
): string | null {
  if (r.exam_centre_id) return r.exam_centre_id;
  return centreForZone(r.qualification_zone, centres)?.id ?? null;
}

/**
 * The venue a stored centre string names, or null.
 *
 * The one place a zone string is matched to a venue, so the register and the
 * allocation screen's labels cannot disagree about which hall "Imeko" is.
 */
export function centreForZone<T extends { town?: string | null; legacy_zone: string | null }>(
  zone: string | null | undefined,
  centres: T[],
): T | null {
  const wanted = zone?.trim().toLowerCase();
  if (!wanted) return null;
  const same = (value: string | null | undefined) => value?.trim().toLowerCase() === wanted;
  return centres.find((c) => same(c.legacy_zone)) ?? centres.find((c) => same(c.town)) ?? null;
}
