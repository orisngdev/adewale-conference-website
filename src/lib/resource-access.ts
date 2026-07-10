// Tiered resource access: content unlocks as a school progresses through the
// competition. The ladder mirrors registrations.status — verified (accepted) →
// qualified (past zonals) → finalist — so releasing material "stage by stage" is
// just admin promoting schools. A resource's `access` (Sanity) names the minimum
// tier; anyone below it sees the item listed but locked, with the file withheld
// SERVER-side (the URL never reaches their browser).

export type ResourceAccess = "public" | "accepted" | "qualified" | "finalist";

const ACCESS_RANK: Record<ResourceAccess, number> = {
  public: 0,
  accepted: 1,
  qualified: 2,
  finalist: 3,
};

/** Minimum tier a resource demands (unknown/missing → public). */
export function accessRank(access?: string | null): number {
  return ACCESS_RANK[(access ?? "public") as ResourceAccess] ?? 0;
}

/** Tier a school's registration status grants. */
export function statusRank(status?: string | null): number {
  switch (status) {
    case "verified":
      return 1;
    case "qualified":
      return 2;
    case "finalist":
      return 3;
    default:
      // submitted / declined / no registration → public tier only.
      return 0;
  }
}

export function canAccess(access: string | null | undefined, status: string | null | undefined) {
  return accessRank(access) <= statusRank(status);
}

export const ACCESS_LABEL: Record<Exclude<ResourceAccess, "public">, string> = {
  accepted: "Accepted schools",
  qualified: "Qualified schools",
  finalist: "Finalists",
};

export function lockHint(access?: string | null): string {
  switch (access) {
    case "finalist":
      return "Unlocks for finalist schools";
    case "qualified":
      return "Unlocks when your school qualifies past zonals";
    default:
      return "Unlocks once your school's entry is accepted";
  }
}
