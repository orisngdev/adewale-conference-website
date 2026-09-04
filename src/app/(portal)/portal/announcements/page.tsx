import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, PortalBody, PortalHeader } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import {
  ANNOUNCEMENT_COLUMNS,
  mapAnnouncement,
  type AnnouncementRow,
} from "@/lib/announcements";

export const metadata = pageMetadata("Announcements", "Announcements from the ASC team.");
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const supabase = await createClient();
  // No profile filter: RLS (announcements_educator_read → can_read_announcement)
  // returns only the sent announcements aimed at this educator's school(s).
  // Students hold no school membership, so they see nothing here.
  const { data } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(100);
  const announcements = ((data ?? []) as unknown as AnnouncementRow[]).map(mapAnnouncement);

  return (
    <>
      <PortalHeader
        title="Announcements"
        subtitle={
          announcements.length
            ? "Updates from the ASC team"
            : "Updates from the ASC team will appear here"
        }
      />
      <PortalBody>
        {announcements.length === 0 ? (
          <EmptyState title="No announcements yet">
            Notices about venues, deadlines and competition arrangements will appear
            here — and land in your inbox.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-foreground/5">
            {announcements.map((a) => (
              <Link
                key={a.id}
                href={`/portal/announcements/${a.id}`}
                className="block p-4 hover:bg-foreground/2"
              >
                <p className="font-medium text-foreground">{a.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {[
                    a.sentAt ? new Date(a.sentAt).toLocaleDateString() : null,
                    a.editionYear ? `${a.editionYear} edition` : null,
                    a.attachments.length
                      ? `${a.attachments.length} attachment${a.attachments.length === 1 ? "" : "s"}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
            ))}
          </Card>
        )}
      </PortalBody>
    </>
  );
}
