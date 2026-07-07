import PublicLayout from "@/components/layout/public-layout";
import { SanityLive } from "@/sanity/lib/live";

// Shared chrome (nav + footer) for every public page. Authenticated pages will
// live in a sibling (portal) group with their own layout.
// SanityLive lives here (not the root layout) so its live-CMS connection only
// runs on the public marketing site, not inside the portal.
export default function PublicGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PublicLayout>
      {children}
      <SanityLive />
    </PublicLayout>
  );
}
