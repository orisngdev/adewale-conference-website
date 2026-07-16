"use client";

import { useEffect } from "react";
import { createClient } from "@/supabase/client";
import { flushPractice } from "@/lib/offline/practice-queue";

// Registers the service worker in PRODUCTION only (after load, so it never blocks
// first paint) and flushes any practice results buffered offline — on boot and
// whenever connectivity returns. Mounted at the app root so the SW registers on
// EVERY page (public site + portal) — a registered SW is one of Chrome's PWA
// install criteria, so the home-page "Install app" button needs it site-wide.
//
// In development the SW is actively UNREGISTERED and its caches cleared: it serves
// /_next/static cache-first, which would hand the browser stale compiled chunks and
// break HMR / cause hydration mismatches against freshly SSR-ed HTML.
export default function RegisterSW() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
        if (document.readyState === "complete") onLoad();
        else window.addEventListener("load", onLoad, { once: true });
      } else {
        // Tear down any SW a prior session left behind, and drop its caches, so the
        // browser stops serving stale chunks/HTML in dev.
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.forEach((r) => r.unregister()))
          .catch(() => {});
        if (typeof caches !== "undefined") {
          caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
        }
      }
    }

    const supabase = createClient();
    const flush = () => void flushPractice(supabase);
    flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, []);

  return null;
}
