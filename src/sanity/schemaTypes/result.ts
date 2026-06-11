import { defineType, defineField } from "sanity";

export const result = defineType({
  name: "result",
  title: "Result",
  type: "document",
  fields: [
    defineField({
      name: "edition",
      title: "Edition",
      type: "reference",
      to: [{ type: "edition" }],
      validation: (r) => r.required(),
    }),
    defineField({ name: "category", title: "Category", type: "string" }),
    defineField({ name: "position", title: "Position", type: "string" }),
    defineField({ name: "schoolName", title: "School name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "studentNames", title: "Student names", type: "array", of: [{ type: "string" }] }),
    defineField({ name: "zone", title: "Zone", type: "string" }),
    defineField({ name: "score", title: "Score", type: "number" }),
  ],
  preview: { select: { title: "schoolName", subtitle: "category" } },
});
