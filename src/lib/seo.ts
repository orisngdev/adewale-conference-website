import type { Metadata } from "next";

/**
 * Per-page metadata helper. The root layout sets the title template
 * (`%s | Adewale Students Conference`) and metadataBase, so pages only supply a
 * short title + description and get consistent OpenGraph/Twitter tags for free.
 */
export function pageMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}
