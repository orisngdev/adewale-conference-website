import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import { Markdown } from "@/components/portal/markdown";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import {
  ANNOUNCEMENT_COLUMNS,
  formatFileSize,
  mapAnnouncement,
  type AnnouncementRow,
} from "@/lib/announcements";

export const metadata = pageMetadata("Announcement", "An announcement from the ASC team.");
export const dynamic = "force-dynamic";

export default async function AnnouncementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect(`/portal/login?redirectTo=/portal/announcements/${id}`);

  const supabase = await createClient();
  // RLS decides visibility. Nothing back means: not sent, not aimed at this
  // educator's school(s), or no such announcement — all of which are a 404 here,
  // so we never confirm the existence of something they may not read.
  const { data } = await supabase
    .from("announcements")
    .select(ANNOUNCEMENT_COLUMNS)
    .eq("id", id)
    .eq("status", "sent")
    .maybeSingle();
  if (!data) notFound();
  const announcement = mapAnnouncement(data as unknown as AnnouncementRow);

  return (
    <>
      {/* PortalHeader/PortalBody, not PageShell: this route sits directly under
          (portal)/layout.tsx, whose <main> adds no padding — the sidebar
          layouts are what supply it for /portal/school and /portal/admin. */}
      <PortalHeader
        title={announcement.title}
        subtitle={
          announcement.sentAt ? new Date(announcement.sentAt).toLocaleString() : undefined
        }
      />
      <PortalBody>
        <div>
          <Link
            href="/portal/announcements"
            className="text-xs uppercase tracking-[0.2em] text-primary hover:underline"
          >
            ← All announcements
          </Link>
        </div>

        <Card className="p-5 md:p-6">
          <Markdown source={announcement.body} />
        </Card>

        {announcement.attachments.length ? (
          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              {announcement.attachments.length === 1 ? "Attachment" : "Attachments"}
            </p>
            <ul className="divide-y divide-foreground/5">
              {announcement.attachments.map((file) => (
                <li
                  key={file.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.fileName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.sizeBytes)}
                    </p>
                  </div>
                  <a
                    href={`/api/announcements/${id}/files/${file.id}/download`}
                    className="text-xs uppercase tracking-[0.15em] text-primary hover:underline shrink-0"
                  >
                    Download ↓
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </PortalBody>
    </>
  );
}
