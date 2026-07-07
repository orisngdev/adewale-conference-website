export type UserRole = "student" | "coordinator" | "admin";

export type RegistrationStatus =
  | "submitted"
  | "verified"
  | "qualified"
  | "finalist";

export interface Certificate {
  id: string;
  type: string | null;
  asset_url: string | null;
}

export interface Rep {
  name: string;
  level?: string;
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
  reps: unknown;
  schools: { name: string | null } | null;
  profiles: { email: string | null; full_name: string | null } | null;
  certificates: { id: string; type: string | null }[];
}
