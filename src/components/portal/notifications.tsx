import { Card } from "@/components/portal/ui";
import { createClient } from "@/supabase/server";
import { markAllNotificationsRead } from "./notification-actions";

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
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, read")
    .order("created_at", { ascending: false })
    .limit(8);

  const items = (data ?? []) as NotificationRow[];
  if (items.length === 0) return null;
  const unread = items.filter((n) => !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bebas text-2xl text-[#0A0F1E] tracking-wide">
          Notifications{unread ? ` (${unread})` : ""}
        </h2>
        {unread ? (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="text-xs uppercase tracking-[0.2em] text-[#E8A020] hover:underline"
            >
              Mark all read
            </button>
          </form>
        ) : null}
      </div>
      <Card className="divide-y divide-[#0A0F1E]/5">
        {items.map((n) => (
          <div
            key={n.id}
            className={`p-4 ${!n.read ? "bg-[rgba(232,160,32,0.07)]" : ""}`}
          >
            <p className="font-medium text-[#0A0F1E]">{n.title}</p>
            {n.body ? (
              <p className="text-sm text-[#4A4E5C] mt-0.5">{n.body}</p>
            ) : null}
          </div>
        ))}
      </Card>
    </div>
  );
}
