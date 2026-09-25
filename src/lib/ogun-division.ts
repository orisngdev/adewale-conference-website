// Ogun State's twenty LGAs sit in four historic administrative divisions, and
// the competition qualifies schools by division as well as by LGA. The mapping
// is geography, not data: it has not changed in the life of the state and is not
// something an admin should be typing into a table, so it lives here with the
// LGA list it keys off (LGA_OPTIONS in ./forms) rather than in the database.

export const OGUN_DIVISIONS = ["Egba", "Yewa", "Ijebu", "Remo"] as const;
export type OgunDivision = (typeof OGUN_DIVISIONS)[number];

const BY_DIVISION: Record<OgunDivision, string[]> = {
  Egba: ["Abeokuta North", "Abeokuta South", "Odeda", "Obafemi Owode", "Ewekoro", "Ifo"],
  Yewa: ["Yewa North", "Yewa South", "Imeko Afon", "Ipokia", "Ado-Odo/Ota"],
  Ijebu: [
    "Ijebu Ode",
    "Ijebu East",
    "Ijebu North",
    "Ijebu North East",
    "Odogbolu",
    "Ogun Waterside",
  ],
  Remo: ["Sagamu", "Ikenne", "Remo North"],
};

/** `schools.lga` is free text from a registration form, so "Ado-Odo/Ota",
 *  "Ado Odo / Ota" and "ADO-ODO OTA" all have to land on the same division.
 *  Separators and case are dropped; the remaining letters must match exactly, so
 *  "Ijebu North" never collides with "Ijebu North East". */
function key(lga: string): string {
  return lga.toLowerCase().replace(/[^a-z]/g, "");
}

const LOOKUP = new Map<string, OgunDivision>(
  (Object.entries(BY_DIVISION) as [OgunDivision, string[]][]).flatMap(([division, lgas]) =>
    lgas.map((lga) => [key(lga), division] as const),
  ),
);

/** The division an LGA belongs to, or null for anything unrecognised — a typo,
 *  a blank, or an LGA outside Ogun. Null is deliberate: a school whose division
 *  we cannot establish must not be swept into someone else's divisional quota. */
export function divisionOf(lga: string | null | undefined): OgunDivision | null {
  const trimmed = lga?.trim();
  if (!trimmed) return null;
  return LOOKUP.get(key(trimmed)) ?? null;
}

/** Every LGA the map knows, for the check that it stays in step with LGA_OPTIONS. */
export function mappedLgas(): string[] {
  return Object.values(BY_DIVISION).flat();
}
