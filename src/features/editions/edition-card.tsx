import Image from "next/image";
import Link from "next/link";
import { urlForImage } from "@/sanity/lib/image";
import type { EditionListItem } from "@/sanity/types";

const STATUS_LABEL: Record<string, string> = {
  upcoming: "Upcoming",
  active: "In progress",
  completed: "Completed",
};

export default function EditionCard({ edition }: { edition: EditionListItem }) {
  return (
    <Link
      href={`/editions/${edition.year}`}
      className="group block border border-[rgba(10,15,30,0.1)] bg-white overflow-hidden hover:border-[#E8A020] transition-colors"
    >
      <div className="relative aspect-[16/10] bg-[#0A0F1E]">
        {edition.heroImage ? (
          <Image
            src={urlForImage(edition.heroImage).width(800).height(500).url()}
            alt={edition.theme}
            fill
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : null}
        <span className="absolute top-3 left-3 font-bebas text-3xl text-primary leading-none">
          {edition.year}
        </span>
      </div>
      <div className="p-5">
        {edition.status ? (
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
            {STATUS_LABEL[edition.status] ?? edition.status}
          </span>
        ) : null}
        <h3 className="font-bebas text-2xl text-foreground leading-tight mt-1">
          {edition.theme}
        </h3>
      </div>
    </Link>
  );
}
