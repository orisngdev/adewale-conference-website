import { defineType, defineField } from "sanity";

export const sponsor = defineType({
  name: "sponsor",
  title: "Sponsor",
  type: "document",
  fields: [
    defineField({ name: "name", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "tier",
      title: "Tier",
      type: "string",
      options: { list: ["Platinum", "Gold", "Silver", "Bronze", "Scholarship"] },
    }),
    defineField({ name: "logo", title: "Logo", type: "image" }),
    defineField({ name: "url", title: "Website", type: "url" }),
  ],
  preview: { select: { title: "name", subtitle: "tier", media: "logo" } },
});
