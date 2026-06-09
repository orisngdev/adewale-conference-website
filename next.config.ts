import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Ensure the email HTML templates are traced into the serverless route
  // handlers that read them at runtime.
  outputFileTracingIncludes: {
    "/api/registration": ["./src/emails/**/*"],
    "/api/sponsorship": ["./src/emails/**/*"],
  },
};

export default nextConfig;
