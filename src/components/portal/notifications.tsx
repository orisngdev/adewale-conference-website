import { Card } from "@/components/portal/ui";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./notification-actions";

interface NotificationRow {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
}

// Renders the current user's recent notifications. Returns null when there are
// none, so dashboards can drop it in unconditionally.
export async function Notifications() {
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) return null;
  // Explicitly self-scoped (belt-and-suspenders alongside notif_self_read RLS).
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, read")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const items = (data ?? []) as NotificationRow[];
  if (items.length === 0) return null;
  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bebas text-2xl text-foreground tracking-wide">
          Notifications{unread ? ` (${unread})` : ""}
        </h2>
        {unread ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.2em] text-primary hover:underline"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>
      <Card className="divide-y divide-foreground/5">
        {items.map((n) => (
          <div
            key={n.id}
            className={`flex items-start justify-between gap-4 p-4 ${!n.read ? "bg-primary/[0.07]" : ""}`}
          >
            <div>
              <p className="font-medium text-foreground">{n.title}</p>
              {n.body ? (
                <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
              ) : null}
            </div>
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
        ))}
      </Card>
    </div>
  );
}
