import { createImageUrlBuilder } from "@sanity/image-url";
import { dataset, projectId } from "../env";

const builder = createImageUrlBuilder({ projectId: projectId || "placeholder", dataset });

// Derive the accepted source type from the builder so we don't depend on a
// package-internal type path (which moves between @sanity/image-url versions).
export function urlForImage(source: Parameters<typeof builder.image>[0]) {
  return builder.image(source);
}
