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
      options: { list: ["past-question", "study-guide", "syllabus", "video"] },
    }),
    defineField({ name: "subject", title: "Subject", type: "string" }),
    defineField({
      name: "level",
      title: "Level",
      type: "string",
      options: { list: ["SS1", "SS2"] },
    }),
    defineField({ name: "edition", title: "Edition", type: "reference", to: [{ type: "edition" }] }),
    defineField({ name: "file", title: "File", type: "file" }),
    defineField({ name: "externalUrl", title: "External URL", type: "url" }),
    defineField({ name: "body", title: "Body", type: "array", of: [{ type: "block" }] }),
  ],
  preview: { select: { title: "title", subtitle: "type" } },
});
