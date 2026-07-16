import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, PortalBody, PortalHeader } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/components/portal/notification-actions";

export const metadata = pageMetadata("Notifications", "Your portal notifications.");
export const dynamic = "force-dynamic";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

export default async function NotificationsPage() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read, created_at")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as NotificationRow[];
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <PortalHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You're all caught up"}
      />
      <PortalBody>
        {unread > 0 ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.2em] text-primary hover:underline"
            >
              Mark all read
            </button>
          </form>
        ) : null}

        {items.length === 0 ? (
          <EmptyState title="No notifications yet">
            Updates about your registration, competition stages, and results will
            appear here.
          </EmptyState>
        ) : (
          <Card className="divide-y divide-foreground/5">
            {items.map((n) => {
              const body = (
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{n.title}</p>
                  {n.body ? (
                    <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              );
              return (
                <div
                  key={n.id}
                  className={`flex items-start justify-between gap-4 p-4 ${!n.read ? "bg-primary/5" : ""}`}
                >
                  {n.link ? (
                    <Link href={n.link} className="min-w-0 hover:underline">
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                  {!n.read ? (
                    <form action={markNotificationRead.bind(null, n.id)}>
                      <button
                        type="submit"
                        className="text-xs uppercase tracking-wide text-primary hover:underline shrink-0"
                      >
                        Mark read
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </Card>
        )}
      </PortalBody>
    </>
  );
}
