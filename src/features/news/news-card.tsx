import Image from "next/image";
import Link from "next/link";
import { urlForImage } from "@/sanity/lib/image";
import { formatDate } from "@/lib/format";
import type { NewsListItem } from "@/sanity/types";

export default function NewsCard({ post }: { post: NewsListItem }) {
  const meta = [formatDate(post.publishedAt), post.author].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/news/${post.slug}`}
      className="group block border border-[rgba(10,15,30,0.1)] bg-white overflow-hidden hover:border-[#E8A020] transition-colors"
    >
      {post.coverImage ? (
        <div className="relative aspect-[16/10] bg-[#0A0F1E]">
          <Image
            src={urlForImage(post.coverImage).width(800).height(500).url()}
            alt={post.title}
            fill
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      ) : null}
      <div className="p-5">
        {meta ? (
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#4A4E5C]">
            {meta}
          </div>
        ) : null}
        <h3 className="font-bebas text-2xl text-[#0A0F1E] leading-tight mt-1 group-hover:text-[#E8A020] transition-colors">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="text-sm text-[#4A4E5C] mt-2 line-clamp-3">{post.excerpt}</p>
        ) : null}
      </div>
    </Link>
  );
}
