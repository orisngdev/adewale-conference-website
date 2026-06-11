import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
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
};

export default nextConfig;
