import type { ResourceAccess } from "./resource-access";

// Resource types mirror the old Sanity "Resource" document so the portal library
// looks and filters the same. `external-link` and `video` may carry a URL
// instead of an uploaded file.
export const RESOURCE_TYPES = [
  { value: "guidelines", label: "Competition guidelines" },
  { value: "past-question", label: "Past questions" },
  { value: "study-guide", label: "Study guides" },
  { value: "syllabus", label: "Syllabus" },
  { value: "video", label: "Video" },
  { value: "external-link", label: "External link" },
] as const;

export const RESOURCE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  RESOURCE_TYPES.map((t) => [t.value, t.label]),
);

export const RESOURCE_ACCESS_OPTIONS: { value: ResourceAccess; label: string }[] = [
  { value: "public", label: "Public — everyone" },
  { value: "accepted", label: "Accepted schools" },
  { value: "qualified", label: "Qualified schools (post-zonal)" },
  { value: "finalist", label: "Finalists only" },
];

// Who sees a resource. Students see 'student' + 'both'; coordinators and admins
// see everything (so they can attach any material to a Learning Plan).
export type ResourceAudience = "student" | "coordinator" | "both";

export const RESOURCE_AUDIENCE_OPTIONS: { value: ResourceAudience; label: string }[] = [
  { value: "both", label: "Students & coordinators" },
  { value: "student", label: "Students only" },
  { value: "coordinator", label: "Coordinators only" },
];

export const RESOURCE_AUDIENCE_LABEL: Record<string, string> = Object.fromEntries(
  RESOURCE_AUDIENCE_OPTIONS.map((a) => [a.value, a.label]),
);

// Audience values a Student is allowed to see.
export const STUDENT_VISIBLE_AUDIENCE = ["student", "both"] as const;

// Columns selected for a resource everywhere in the app.
export const RESOURCE_COLUMNS =
  "id, title, slug, type, subject, level, edition_year, access, audience, storage_key, file_name, content_type, external_url, body, published, created_at";

export interface ResourceRow {
  id: string;
  title: string;
  slug: string | null;
  type: string | null;
  subject: string | null;
  level: string | null;
  edition_year: number | null;
  access: string | null;
  audience: string | null;
  storage_key: string | null;
  file_name: string | null;
  content_type: string | null;
  external_url: string | null;
  body: string | null;
  published: boolean;
  created_at: string;
}

export interface PortalResource {
  id: string;
  title: string;
  slug: string | null;
  type: string | null;
  subject: string | null;
  level: string | null;
  editionYear: number | null;
  access: ResourceAccess;
  audience: ResourceAudience;
  hasFile: boolean;
  fileName: string | null;
  externalUrl: string | null;
  body: string | null;
  published: boolean;
}

export function mapResource(row: ResourceRow): PortalResource {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    type: row.type,
    subject: row.subject,
    level: row.level,
    editionYear: row.edition_year,
    access: (row.access ?? "public") as ResourceAccess,
    audience: (row.audience ?? "both") as ResourceAudience,
    hasFile: Boolean(row.storage_key),
    fileName: row.file_name,
    externalUrl: row.external_url,
    body: row.body,
    published: row.published,
  };
}

// URL-safe slug from a title; a short suffix keeps it unique enough for links.
export function slugifyResource(title: string, suffix: string) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "resource"}-${suffix}`;
}
