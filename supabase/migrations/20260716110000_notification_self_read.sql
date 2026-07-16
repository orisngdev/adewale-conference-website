-- Fix the notification read leak. The unread badge and the notifications list
-- query `notifications` with no profile_id filter, trusting RLS — but
-- notif_self_read was `profile_id = auth.uid() OR is_admin()`, so every admin
-- saw (and had counted) EVERY user's notifications. Notifications are
-- per-recipient; an admin's own alerts are inserted for their own profile_id,
-- so admins lose nothing by scoping reads to the owner. Idempotent.
drop policy if exists "notif_self_read" on public.notifications;
create policy "notif_self_read" on public.notifications
  for select using (profile_id = auth.uid());
