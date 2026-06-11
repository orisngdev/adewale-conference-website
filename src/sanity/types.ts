import type { Image, PortableTextBlock } from "sanity";

export type EditionStatus = "upcoming" | "active" | "completed";

export interface EditionListItem {
  _id: string;
  year: number;
  theme: string;
  status?: EditionStatus;
  slug: string | null;
  heroImage?: Image;
  startDate?: string;
  endDate?: string;
}

export interface EditionStat {
  label?: string;
  value?: string;
}

export interface EditionSponsor {
  _id: string;
  name: string;
  tier?: string;
  logo?: Image;
  url?: string;
}

export interface Edition extends EditionListItem {
  summary?: PortableTextBlock[];
  stats?: EditionStat[];
  sponsors?: EditionSponsor[];
}

export interface ResultRow {
  _id: string;
  category?: string;
  position?: string;
  schoolName: string;
  studentNames?: string[];
  zone?: string;
  score?: number;
  year?: number;
  theme?: string;
}

export type ResourceType = "past-question" | "study-guide" | "syllabus" | "video";

export interface ResourceListItem {
  _id: string;
  title: string;
  slug: string | null;
  type?: ResourceType;
  subject?: string;
  level?: string;
  hasFile?: boolean;
  externalUrl?: string;
}

export interface Resource extends ResourceListItem {
  body?: PortableTextBlock[];
  fileUrl?: string;
  fileName?: string;
  edition?: { year: number; theme: string } | null;
}

export interface ResourceFilters {
  type: string;
  subject: string;
  level: string;
}

interface NewsBase {
  _id: string;
  title: string;
  slug: string | null;
  publishedAt?: string;
  excerpt?: string;
  coverImage?: Image;
}

export interface NewsListItem extends NewsBase {
  author?: string;
}

export interface NewsAuthor {
  name: string;
  role?: string;
  photo?: Image;
}

export interface NewsPost extends NewsBase {
  body?: PortableTextBlock[];
  tags?: string[];
  author?: NewsAuthor | null;
}

export interface GalleryItem {
  _id: string;
  title?: string;
  caption?: string;
  image: Image;
  year?: number;
}

export interface Sponsor {
  _id: string;
  name: string;
  tier?: string;
  logo?: Image;
  url?: string;
}
