import type { RosterStudent } from "@/components/portal/participant-school-card";
import type {
  IndividualAward,
  StageResult,
  StudentStageResult,
  TournamentGroup,
  TournamentGroupEntry,
  TournamentMatch,
} from "@/supabase/types";

export type PreviewZoneSource = "allocated" | "requested" | "lga" | "none";

/** A rep's own result, plus where its paper can be read. */
export type PreviewRepResult = StudentStageResult & {
  detailHref?: string | null;
  subjectOrder?: string[] | null;
};

export interface PreviewParticipant {
  id: string;
  schoolId: string | null;
  school: string;
  lga: string | null;
  category: string | null;
  email: string | null;
  reps: number;
  roster: RosterStudent[];
  results: StageResult[];
  standing: { stage: string; label: string };
  centre: {
    value: string;
    source: PreviewZoneSource;
    allocated: string | null;
    /** The school's answer, but only when it names a real centre — the only form
     *  safe to pre-select. */
    requested: string | null;
    /** The school's answer exactly as given, so a non-standard one can be shown
     *  rather than reported as "unassigned", which it is not. */
    requestedRaw: string | null;
    isStandard: boolean;
  };
  schoolCerts: { id: string; type: string | null }[];
  studentCertsById: Record<string, { id: string; type: string | null }[]>;
  /** Per-rep stage results, keyed by student id. */
  repResultsById: Record<string, PreviewRepResult[]>;
}

export interface PreviewGroup extends TournamentGroup {
  entries: (TournamentGroupEntry & { school: string })[];
}

export interface PreviewMatch extends TournamentMatch {
  teamAName: string;
  teamBName: string;
  winnerName: string | null;
}

export interface PreviewStudent {
  id: string;
  schoolId: string;
  name: string;
  level: string | null;
  school: string;
}

export interface PreviewAward extends IndividualAward {
  studentName: string;
}

export type PreviewView =
  | "overview"
  | "centres"
  | "qualifications"
  | "groups"
  | "knockouts"
  | "awards";

export type QualificationFilter = "all" | "pending" | "advanced" | "eliminated" | "missing-centre";
