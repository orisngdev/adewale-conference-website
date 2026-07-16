import Link from "next/link";
import type { PortalResource } from "@/lib/resources";

export const TYPE_LABEL: Record<string, string> = {
  guidelines: "Guidelines",
  "past-question": "Past question",
  "study-guide": "Study guide",
  syllabus: "Syllabus",
  video: "Video",
};

export default function ResourceCard({ resource }: { resource: PortalResource }) {
  const meta = [resource.subject, resource.level].filter(Boolean).join(" · ");

  return (
    <Link
      href={resource.slug ? `/resources/${resource.slug}` : "#"}
      className="group block border border-[rgba(10,15,30,0.1)] bg-white p-5 hover:border-[#E8A020] transition-colors"
    >
      {resource.type ? (
        <span className="inline-block bg-[#0A0F1E] text-primary text-[10px] font-bold tracking-[0.18em] uppercase px-2.5 py-1 mb-3">
          {TYPE_LABEL[resource.type] ?? resource.type}
        </span>
      ) : null}
      <h3 className="font-bebas text-xl text-foreground leading-tight group-hover:text-primary transition-colors">
        {resource.title}
      </h3>
      {meta ? (
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground mt-2">
          {meta}
        </div>
      ) : null}
    </Link>
  );
}
