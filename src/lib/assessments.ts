// Shared taxonomy + canonical routes for the assessment domain. The umbrella
// name lives here so it stays swappable in one place.

export const SUBJECTS = [
  "Mathematics & Number Theory",
  "Mechanics & Physics",
  "Chemistry & Kinetics",
  "Ecology & Cellular Biology",
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const LEVELS = ["SS1", "SS2"] as const;
export type Level = (typeof LEVELS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type AssessmentMode = "practice" | "exam";

export const assessmentRoutes = {
  adminList: "/portal/admin/assessments",
  adminEdit: (id: string) => `/portal/admin/assessments/${id}`,
  questionBank: "/portal/admin/question-bank",
  exam: (id: string) => `/portal/cbt/${id}`,
  studentExams: "/portal/student/exams",
  practiceHub: "/portal/student/practice",
  practice: (id: string) => `/portal/student/practice/${id}`,
} as const;
