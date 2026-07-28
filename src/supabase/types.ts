export type UserRole = "student" | "coordinator" | "admin";

// ── Admin permissions (two-tier: view vs. manage, per module) ─────────────────
// Every admin is role="admin" in the DB, so RLS (is_admin()) can't distinguish
// these levels — enforcement lives in the application layer (server actions +
// UI). See src/lib/admin-permissions.ts for route↔module mapping and labels.
export type PermissionModule =
  | "team"
  | "registrations"
  | "participants"
  | "content"
  | "labs"
  | "analytics";

export type AccessLevel = "none" | "view" | "manage";

export type AdminPermissionsMap = Record<PermissionModule, AccessLevel>;

export type AdminRolePreset =
  | "super_admin"
  | "operations"
  | "academic"
  | "lab_manager"
  | "viewer"
  | "custom";

/** No access to anything — the safe default for a non-admin or missing profile. */
export const DEFAULT_EMPTY_PERMISSIONS: AdminPermissionsMap = {
  team: "none",
  registrations: "none",
  participants: "none",
  content: "none",
  labs: "none",
  analytics: "none",
};

export const DEFAULT_SUPER_ADMIN_PERMISSIONS: AdminPermissionsMap = {
  team: "manage",
  registrations: "manage",
  participants: "manage",
  content: "manage",
  labs: "manage",
  analytics: "manage",
};

export const PRESET_ROLE_PERMISSIONS: Record<
  Exclude<AdminRolePreset, "custom">,
  AdminPermissionsMap
> = {
  super_admin: DEFAULT_SUPER_ADMIN_PERMISSIONS,
  operations: {
    team: "none",
    registrations: "manage",
    participants: "manage",
    content: "view",
    labs: "none",
    analytics: "view",
  },
  academic: {
    team: "none",
    registrations: "none",
    participants: "view",
    content: "manage",
    labs: "none",
    analytics: "view",
  },
  lab_manager: {
    team: "none",
    registrations: "none",
    participants: "none",
    content: "view",
    labs: "manage",
    analytics: "view",
  },
  viewer: {
    team: "none",
    registrations: "view",
    participants: "view",
    content: "view",
    labs: "view",
    analytics: "view",
  },
};

// Registration status records ONLY the acceptance decision. Competition
// progress (past-zonals, finalist) lives in the stage-results tables and, for
// resource unlocks, is derived from stage advancement — see resource-access.ts.
export type RegistrationStatus =
  | "submitted"
  | "verified"
  | "declined";

// How a school fared at a single competition stage (the edition moves everyone
// through one shared stage list; this is the per-school result at each).
export type StageOutcome = "pending" | "advanced" | "eliminated";

export const COMPETITION_STAGES = [
  "Qualifications",
  "Grand Finale Group Stage",
  "Round of 16",
  "Quarter Finals",
  "Semi Finals",
  "Finals",
] as const;

export const OPTIONAL_COMPETITION_STAGES = ["Round of 24"] as const;

export const DEFAULT_EDITION_STAGES = [
  "Registration",
  "Qualifications",
  "Grand Finale Group Stage",
  "Round of 16",
  "Quarter Finals",
  "Semi Finals",
  "Finals",
  "Completed",
] as const;

export const QUALIFICATION_REASONS = [
  "Zonal Champion",
  "Top 10",
  "State-wide Qualification",
  "Divisional Qualification",
  "Wildcard",
  "Manual Selection",
] as const;

export type QualificationReason = (typeof QUALIFICATION_REASONS)[number];

export interface StageResult {
  id: string;
  registration_id: string;
  stage: string;
  outcome: StageOutcome;
  score: number | null;
  note: string | null;
  reason?: string | null;
}

// The per-STUDENT mirror of StageResult — how one rep fared at a stage.
export interface StudentStageResult {
  id: string;
  student_id: string;
  stage: string;
  outcome: StageOutcome;
  score: number | null;
  note: string | null;
}

export interface Certificate {
  id: string;
  type: string | null;
  asset_url: string | null;
}

export interface Rep {
  name: string;
  level?: string;
}

export type TournamentMatchKind = "group" | "knockout" | "face_off" | "bye";
export type TournamentMatchStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "needs_face_off"
  | "cancelled";

export interface TournamentGroup {
  id: string;
  edition_year: number;
  stage: string;
  name: string;
  sort_order: number;
  advance_count: number;
}

export interface TournamentGroupEntry {
  id: string;
  group_id: string;
  registration_id: string;
  seed: number | null;
  rank: number | null;
  score: number | null;
  note: string | null;
  advance_override: boolean | null;
}

export interface TournamentMatch {
  id: string;
  edition_year: number;
  stage: string;
  kind: TournamentMatchKind;
  team_a_registration_id: string | null;
  team_b_registration_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winner_registration_id: string | null;
  status: TournamentMatchStatus;
  scheduled_at: string | null;
  venue: string | null;
  note: string | null;
  parent_match_id: string | null;
  slot: number | null;
  superseded_at?: string | null;
}

export interface IndividualAward {
  id: string;
  edition_year: number;
  student_id: string;
  registration_id: string | null;
  stage: string | null;
  title: string;
  note: string | null;
}

export type ReplacementStatus = "pending" | "approved" | "declined";

/** Return shape of the requestReplacement server action (used by its dialog). */
export type ReplacementResult = { ok?: boolean; error?: string };

export interface StudentReplacementRow {
  id: string;
  registration_id: string;
  school_id: string;
  rep_slot: number | null;
  old_student_id: string | null;
  old_name: string;
  old_level: string | null;
  new_name: string;
  new_level: string | null;
  new_details: Record<string, string>;
  reason: string | null;
  status: ReplacementStatus;
  requested_by: string | null;
  reviewed_by: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  schools?: { name: string | null } | null;
}

export interface Edition {
  year: number;
  title: string | null;
  registration_open: boolean;
  stages: string[];
  current_stage: string;
}

export interface ParticipationRow {
  id: string;
  edition_year: number;
  status: RegistrationStatus;
  current_stage: string | null;
  schools: { name: string | null } | null;
}

export interface RegistrationWithRelations {
  id: string;
  edition_year: number;
  status: RegistrationStatus;
  reps: unknown;
  schools: { name: string | null; lga: string | null } | null;
  certificates: Certificate[];
}

export type AssessmentMode = "practice" | "exam";

export interface Assessment {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  edition_year: number | null;
  published: boolean;
  mode?: AssessmentMode;
  max_attempts?: number;
  time_limit_minutes?: number | null;
  content_version?: number;
}
/** @deprecated use Assessment — kept for one release during the rename. */
export type Quiz = Assessment;

export interface Question {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  position?: number;
  mode?: AssessmentMode;
  subject?: string | null;
  level?: string | null;
  topic?: string | null;
  difficulty?: "easy" | "medium" | "hard" | null;
  explanation?: string | null;
}
/** @deprecated use Question — kept for one release during the rename. */
export type QuizQuestion = Question;

export interface AdminRegistrationRow {
  id: string;
  edition_year: number;
  status: RegistrationStatus;
  claim_code: string | null;
  contact_email: string | null;
  contact_name: string | null;
  onboarded_at: string | null;
  provisioned_count: number | null;
  reps: unknown;
  /** Full entry keyed by Airtable field names (genders, DOBs, guardians, contacts). */
  details: Record<string, string> | null;
  schools: { name: string | null } | null;
  profiles: { email: string | null; full_name: string | null } | null;
  certificates: { id: string; type: string | null }[];
}
