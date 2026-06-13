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

export interface Quiz {
  id: string;
  title: string;
  subject: string | null;
  level: string | null;
  edition_year: number | null;
  published: boolean;
  max_attempts?: number;
  time_limit_minutes?: number | null;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correct_index: number;
  position: number;
}

export interface AdminRegistrationRow {
  id: string;
  edition_year: number;
  status: RegistrationStatus;
  claim_code: string | null;
  schools: { name: string | null } | null;
  profiles: { email: string | null; full_name: string | null } | null;
  certificates: { id: string; type: string | null }[];
}
