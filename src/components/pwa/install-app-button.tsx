"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

// "Install app" button for the portal header. Chrome/Edge/Android: captures
// beforeinstallprompt and triggers the native install dialog. iOS Safari (no
// event): shows Add-to-Home-Screen instructions. Renders nothing once the app
// is installed or where installing isn't supported.
export default function InstallAppButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    setIos(isIos());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setIos(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt && !ios) return null;

  async function onClick() {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setPrompt(null);
      return;
    }
    setShowIosTip((v) => !v);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1.5 rounded-md border border-primary/50 px-2.5 py-1.5 text-xs uppercase tracking-[0.15em] text-primary hover:bg-primary hover:text-[#0A0F1E] transition-colors"
      >
        <Download className="size-3.5" strokeWidth={2.5} />
        <span className="hidden sm:inline">Install app</span>
        <span className="sm:hidden">Install</span>
      </button>
      {showIosTip ? (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-md border border-foreground/10 bg-card p-3 text-left shadow-lg">
          <p className="text-xs text-foreground font-medium mb-1">Install on iPhone/iPad</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            In Safari, tap the <span className="font-medium text-foreground">Share</span> button,
            then <span className="font-medium text-foreground">Add to Home Screen</span>.
          </p>
        </div>
      ) : null}
    </div>
  );
}
