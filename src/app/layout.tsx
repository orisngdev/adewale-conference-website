import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import { SITE_URL } from "@/lib/site";

export const viewport: Viewport = {
  themeColor: "#0A0F1E",
  // Let the PWA draw under the notch/home-indicator so safe-area insets apply.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ASC Portal", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    apple: "/icons/icon-maskable-192.png",
  },
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
      </body>
    </html>
  );
}
