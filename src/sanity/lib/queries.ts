import { defineQuery } from "next-sanity";

export const editionsQuery = defineQuery(`
  *[_type == "edition"] | order(year desc) {
    _id, year, theme, status, "slug": slug.current,
    heroImage, startDate, endDate
  }
`);

export const editionYearsQuery = defineQuery(`
  *[_type == "edition" && defined(year)].year
`);

export const editionByYearQuery = defineQuery(`
  *[_type == "edition" && year == $year][0] {
    _id, year, theme, status, "slug": slug.current,
    startDate, endDate, heroImage, summary, stats,
    "sponsors": sponsors[]->{ _id, name, tier, logo, url }
  }
`);

export const resultsQuery = defineQuery(`
  *[_type == "result"] {
    _id, category, position, schoolName, studentNames, zone, score,
    "year": edition->year, "theme": edition->theme
  } | order(year desc, category asc, position asc)
`);

// Resources moved to the portal-native library (Supabase `resources` table +
// S3); see ADR-0006. The Sanity `resource` type has been retired.

export const newsPostsQuery = defineQuery(`
  *[_type == "newsPost" && defined(slug.current)] | order(publishedAt desc) {
    _id, title, "slug": slug.current, publishedAt, excerpt, coverImage,
    "author": author->name
  }
`);

export const newsSlugsQuery = defineQuery(`
  *[_type == "newsPost" && defined(slug.current)].slug.current
`);

export const newsBySlugQuery = defineQuery(`
  *[_type == "newsPost" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, publishedAt, excerpt, coverImage, body, tags,
    "author": author->{ name, role, photo }
  }
`);

export const galleryItemsQuery = defineQuery(`
  *[_type == "galleryItem" && defined(image.asset)] | order(_createdAt desc) {
    _id, title, caption, image, "year": edition->year
  }
`);

// Sponsors are managed in Airtable (public form → enquiries); the Sanity
// `sponsor` type has been retired. See admin/sponsors.

// The edition to surface in the portal: soonest upcoming/active one.
export const currentEditionQuery = defineQuery(`
  *[_type == "edition" && status in ["upcoming", "active"]] | order(year desc)[0] {
    _id, year, theme, status, "slug": slug.current, startDate, endDate
  }
`);

// A school's results across editions (portal — coordinator view).
export const resultsBySchoolQuery = defineQuery(`
  *[_type == "result" && schoolName == $school] {
    _id, category, position, schoolName, studentNames, zone, score,
    "year": edition->year, "theme": edition->theme
  } | order(year desc, category asc)
`);

// Results for any of several schools (a coordinator/student's own schools).
export const resultsBySchoolsQuery = defineQuery(`
  *[_type == "result" && schoolName in $schools] {
    _id, category, position, schoolName, studentNames, zone, score,
    "year": edition->year, "theme": edition->theme
  } | order(year desc, category asc)
`);
