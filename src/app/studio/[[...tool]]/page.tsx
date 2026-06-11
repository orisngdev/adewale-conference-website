import type { Metadata, Viewport } from "next";
import Studio from "./Studio";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Embedded Sanity Studio at /studio. Renders the client-only <Studio> so the
// config never crosses the server→client boundary.
export default function StudioPage() {
  return <Studio />;
}
