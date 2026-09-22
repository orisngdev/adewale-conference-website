// How a name resolves against a school's existing roster. Split out of
// provisionStudent because that needs a service-role client and so is
// unreachable from `npm test` — this is the part that has actually gone wrong.
import { personNameKey } from "@/lib/person-identity";

export type RosterRow = {
  id: string;
  name: string;
  access_code: string | null;
  auth_user_id: string | null;
  edition_year: number | null;
  deactivated_at: string | null;
};

export type RosterMatch =
  /** Active and able to sign in: keep the code, re-tag the edition. */
  | { kind: "reuse"; row: RosterRow }
  /** Retired in THIS edition — they were replaced and are being named again. */
  | { kind: "returning"; row: RosterRow }
  /** Matched a row with no working login (imported for history only): mint a
   *  code onto it rather than beside it. */
  | { kind: "adopt"; row: RosterRow }
  | { kind: "insert" };

export function matchRoster(
  roster: RosterRow[],
  name: string,
  editionYear: number,
): RosterMatch {
  // personNameKey, not `ilike` — that only caught case, so a re-ordered name
  // provisioned a second row for the same child.
  const key = personNameKey(name);
  const sameName = roster.filter((s) => personNameKey(s.name) === key);

  const active = sameName.find((s) => !s.deactivated_at);
  if (!active) {
    // Retired in an EARLIER edition is an ordinary returning student and
    // provisions afresh; only this edition's retirement means "replaced".
    const replaced = sameName.find(
      (s) => s.deactivated_at && s.edition_year === editionYear,
    );
    return replaced ? { kind: "returning", row: replaced } : { kind: "insert" };
  }

  return active.access_code && active.auth_user_id
    ? { kind: "reuse", row: active }
    : { kind: "adopt", row: active };
}
