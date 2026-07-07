import Link from "next/link";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <>
      <PortalHeader title="You're offline" subtitle="No connection right now" />
      <PortalBody>
        <Card className="p-8 text-center space-y-3">
          <p className="font-bebas text-3xl text-foreground">No internet connection</p>
          <p className="serif-display italic text-muted-foreground">
            Practice drills and study packs you&apos;ve already opened still work offline. Reconnect to
            sync your scores and load new content.
          </p>
          <div className="pt-2">
            <Link
              href="/portal/student/practice"
              className="inline-block text-xs uppercase tracking-[0.2em] text-primary hover:underline"
            >
              Go to practice →
            </Link>
          </div>
        </Card>
      </PortalBody>
    </>
  );
}
