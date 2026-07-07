import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow HMR / dev resources when testing from a phone on the LAN (e.g. the PWA).
  // Dev-only; add your machine's current LAN IP if it changes.
  allowedDevOrigins: ["192.168.100.14"],
  // Sanity Studio packages must load as real Node modules, not be bundled by
  // Turbopack — bundling them breaks React context at build time.
  serverExternalPackages: ["sanity", "@sanity/vision", "styled-components"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  // Ensure the email HTML templates are traced into the serverless route
  // handlers that read them at runtime.
  outputFileTracingIncludes: {
    "/api/registration": ["./src/emails/**/*"],
    "/api/sponsorship": ["./src/emails/**/*"],
  },
  // Let the service worker control the whole origin, and keep it uncached so a
  // new release's sw.js is picked up promptly.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
