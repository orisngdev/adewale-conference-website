import Image from "next/image";
import { urlForImage } from "@/sanity/lib/image";
import type { GalleryItem } from "@/sanity/types";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      {items.map((item) => (
        <figure
          key={item._id}
          className="relative aspect-square bg-[#0A0F1E] overflow-hidden group"
        >
          <Image
            src={urlForImage(item.image).width(800).height(800).url()}
            alt={item.title ?? item.caption ?? "Gallery image"}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
          {item.caption ? (
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A0F1E]/90 to-transparent p-4 text-xs text-[#F0EAD8] opacity-0 group-hover:opacity-100 transition-opacity">
              {item.caption}
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
