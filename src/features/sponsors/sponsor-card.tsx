import Image from "next/image";
import { urlForImage } from "@/sanity/lib/image";
import type { Sponsor } from "@/sanity/types";

export default function SponsorCard({ sponsor }: { sponsor: Sponsor }) {
  const content = (
    <div className="relative h-28 flex items-center justify-center border border-[rgba(10,15,30,0.1)] bg-white">
      {sponsor.logo ? (
        <Image
          src={urlForImage(sponsor.logo).width(400).height(220).fit("max").url()}
          alt={sponsor.name}
          fill
          className="object-contain p-5"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
      ) : (
        <span className="font-bebas text-xl text-foreground text-center px-3">
          {sponsor.name}
        </span>
      )}
    </div>
  );

  return sponsor.url ? (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block hover:opacity-90 transition-opacity"
    >
      {content}
    </a>
  ) : (
    content
  );
}
