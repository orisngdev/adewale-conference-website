import { defineType, defineField } from "sanity";

export const edition = defineType({
  name: "edition",
  title: "Edition",
  type: "document",
  fields: [
    defineField({ name: "year", title: "Year", type: "number", validation: (r) => r.required() }),
    defineField({ name: "theme", title: "Theme", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "theme" },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: { list: ["upcoming", "active", "completed"], layout: "radio" },
      initialValue: "upcoming",
    }),
    defineField({ name: "startDate", title: "Start date", type: "date" }),
    defineField({ name: "endDate", title: "End date", type: "date" }),
    defineField({ name: "heroImage", title: "Hero image", type: "image", options: { hotspot: true } }),
    defineField({ name: "summary", title: "Summary", type: "array", of: [{ type: "block" }] }),
    defineField({
      name: "stats",
      title: "Stats",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "label", type: "string" }),
            defineField({ name: "value", type: "string" }),
          ],
        },
      ],
    }),
    defineField({
      name: "sponsors",
      title: "Sponsors",
      type: "array",
      of: [{ type: "reference", to: [{ type: "sponsor" }] }],
    }),
  ],
  preview: { select: { title: "theme", subtitle: "year", media: "heroImage" } },
});
