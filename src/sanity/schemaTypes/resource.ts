import { defineType, defineField } from "sanity";

export const resource = defineType({
  name: "resource",
  title: "Resource",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "type",
      title: "Type",
      type: "string",
      options: { list: ["past-question", "study-guide", "syllabus", "video", "external-link"] },
    }),
    defineField({ name: "subject", title: "Subject", type: "string" }),
    defineField({
      name: "level",
      title: "Level",
      type: "string",
      options: { list: ["SS1", "SS2"] },
    }),
    defineField({ name: "edition", title: "Edition", type: "reference", to: [{ type: "edition" }] }),
    defineField({
      name: "access",
      title: "Who can access this",
      description:
        "Public = everyone (default). The other tiers unlock as a school progresses through the competition: Accepted (entry confirmed) → Qualified (past zonals) → Finalists. Locked resources are listed but their files are withheld.",
      type: "string",
      initialValue: "public",
      options: {
        list: [
          { title: "Public — everyone", value: "public" },
          { title: "Accepted schools", value: "accepted" },
          { title: "Qualified schools (post-zonal)", value: "qualified" },
          { title: "Finalists only", value: "finalist" },
        ],
        layout: "radio",
      },
    }),
    defineField({ name: "file", title: "File", type: "file" }),
    defineField({ name: "externalUrl", title: "External URL", type: "url" }),
    defineField({ name: "body", title: "Body", type: "array", of: [{ type: "block" }] }),
  ],
  preview: { select: { title: "title", subtitle: "type" } },
});
