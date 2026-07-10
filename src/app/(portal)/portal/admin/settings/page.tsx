import { Button } from "@/components/ui/button";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import AccountSettings from "@/components/portal/account-settings";
import SettingsTabs from "@/components/portal/settings-tabs";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import type { UserRole } from "@/supabase/types";
import { extractYouTubeId, youTubeEmbedUrl } from "@/lib/youtube";
import { inviteTeamMember, revokeTeamInvite } from "../actions";
import { setHomeVideo } from "./actions";

export const metadata = pageMetadata("Settings", "Your account, site settings, and team.");
export const dynamic = "force-dynamic";

const inputCls =
  "flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

interface InviteRow {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
  expires_at: string;
}

export default async function AdminSettings() {
  const supabase = await createClient();
  const user = await getSessionUser();

  const [{ data: videoSetting }, { data: inviteData }] = await Promise.all([
    supabase
      .from("site_settings")
      .select("value")
      .eq("key", "home_video_url")
      .maybeSingle(),
    supabase
      .from("team_invites")
      .select("id, email, role, created_at, expires_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const videoUrl = (videoSetting?.value as string | null) ?? "";
  const videoId = videoUrl ? extractYouTubeId(videoUrl) : null;
  const invites = (inviteData ?? []) as InviteRow[];

  const accountTab = <AccountSettings showHeading={false} />;

  const videoTab = (
    <Card className="p-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        A YouTube video shown on the portal home page for all users — students and
        educators. Leave the field empty and save to remove it.
      </p>
      <form action={setHomeVideo} className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          name="url"
          defaultValue={videoUrl}
          placeholder="https://www.youtube.com/watch?v=…"
          className={inputCls}
        />
        <Button type="submit" size="sm" variant="outline">
          Save
        </Button>
      </form>
      {videoId ? (
        <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md">
          <iframe
            src={youTubeEmbedUrl(videoId)}
            title="Home page video preview"
            className="w-full h-full"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : videoUrl ? (
        <p className="text-sm text-red-600">
          Saved value doesn&apos;t look like a YouTube link — paste a full video URL.
        </p>
      ) : null}
    </Card>
  );

  const teamTab = (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <p className="text-sm text-muted-foreground">
          Invite a teammate as an admin. They&apos;ll get an email inviting them to
          create a portal account with this address — admin access is set up
          automatically when they sign up. If the email already has an account,
          it&apos;s upgraded right away.
        </p>
        <form action={inviteTeamMember} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="teammate@example.com"
            className={inputCls}
          />
          <Button type="submit" size="sm" variant="outline">
            Send invite
          </Button>
        </form>
      </Card>

      {invites.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {invites.length} pending invite{invites.length === 1 ? "" : "s"}
          </p>
          {invites.map((inv) => (
            <Card
              key={inv.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div>
                <span className="text-foreground font-medium">{inv.email}</span>
                <p className="text-sm text-muted-foreground capitalize">
                  {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString()}
                </p>
              </div>
              <form action={revokeTeamInvite.bind(null, inv.id)}>
                <Button type="submit" size="sm" variant="outline">
                  Revoke
                </Button>
              </form>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <PortalHeader title="Settings" subtitle={user?.email ?? undefined} />
      <PortalBody>
        <SettingsTabs
          tabs={[
            { label: "Your account", content: accountTab },
            { label: "Home page video", content: videoTab },
            { label: "Team", content: teamTab },
          ]}
        />
      </PortalBody>
    </>
  );
}
