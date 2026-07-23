// Age from a date-of-birth string. Registration DOBs come from a date input
// ("YYYY-MM-DD") or the Airtable mirror; anything unparseable yields null so
// callers can omit the age cleanly. Whole years, floored (the completed-years
// convention), and never negative.
export function ageFromDob(dob: string | null | undefined, asOf: Date = new Date()): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;

  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

/** "Ada Obi (SS2, age 15)" style label — age appended only when derivable. */
export function repLabel(name: string, level?: string | null, dob?: string | null): string {
  const age = ageFromDob(dob);
  const bits = [level, age != null ? `age ${age}` : null].filter(Boolean);
  return bits.length ? `${name} (${bits.join(", ")})` : name;
}
