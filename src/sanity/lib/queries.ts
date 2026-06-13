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

// Filtered resource list. Empty-string params mean "any" for that facet.
export const resourcesQuery = defineQuery(`
  *[_type == "resource"
    && ($type == "" || type == $type)
    && ($subject == "" || subject == $subject)
    && ($level == "" || level == $level)
  ] | order(title asc) {
    _id, title, "slug": slug.current, type, subject, level,
    "hasFile": defined(file.asset), externalUrl
  }
`);

export const resourceSubjectsQuery = defineQuery(`
  *[_type == "resource" && defined(subject)].subject
`);

export const resourceSlugsQuery = defineQuery(`
  *[_type == "resource" && defined(slug.current)].slug.current
`);

export const resourceBySlugQuery = defineQuery(`
  *[_type == "resource" && slug.current == $slug][0] {
    _id, title, "slug": slug.current, type, subject, level, body, externalUrl,
    "fileUrl": file.asset->url, "fileName": file.asset->originalFilename,
    "edition": edition->{ year, theme }
  }
`);

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

export const sponsorsQuery = defineQuery(`
  *[_type == "sponsor"] | order(name asc) {
    _id, name, tier, logo, url
  }
`);

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
