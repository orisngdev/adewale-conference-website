import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import { SITE_URL } from "@/lib/site";
import { SanityLive } from "@/sanity/lib/live";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Adewale Students Conference",
    template: "%s | Adewale Students Conference",
  },
  description:
    "Ogun State's flagship STEM competition for senior secondary students — building tomorrow's geniuses today.",
  openGraph: {
    type: "website",
    siteName: "Adewale Students Conference",
    url: SITE_URL,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <Providers>{children}</Providers>
        <SanityLive />
      </body>
    </html>
  );
}
