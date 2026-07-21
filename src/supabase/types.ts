export type UserRole = "student" | "coordinator" | "admin";

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

export interface StageResult {
  id: string;
  registration_id: string;
  stage: string;
  outcome: StageOutcome;
  score: number | null;
  note: string | null;
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
