import { defineType, defineField } from "sanity";

export const person = defineType({
  name: "person",
  title: "Person",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "role",
      title: "Role",
      type: "string",
      options: { list: ["founder", "team", "judge"] },
    }),
    defineField({ name: "photo", title: "Photo", type: "image", options: { hotspot: true } }),
    defineField({ name: "bio", title: "Bio", type: "text", rows: 4 }),
  ],
  preview: { select: { title: "name", subtitle: "role", media: "photo" } },
});
