"use client";

import dynamic from "next/dynamic";
import config from "../../../../sanity.config";

// The Studio is a client-only SPA — server-rendering Sanity's component tree
// trips React internals (useMemoCache). Load it client-side only.
const NextStudio = dynamic(
  () => import("next-sanity/studio").then((mod) => mod.NextStudio),
  { ssr: false },
);

export default function Studio() {
  return <NextStudio config={config} />;
}
