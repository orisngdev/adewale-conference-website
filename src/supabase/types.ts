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

export interface RegistrationWithRelations {
  id: string;
  edition_year: number;
  status: RegistrationStatus;
  reps: unknown;
  schools: { name: string | null; lga: string | null } | null;
  certificates: Certificate[];
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
