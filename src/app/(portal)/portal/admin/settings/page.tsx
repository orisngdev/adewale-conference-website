import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { SubmitButton } from "@/components/portal/submit-button";
import { Card, PortalBody, PortalHeader } from "@/components/portal/ui";
import AccountSettings from "@/components/portal/account-settings";
import SettingsTabs from "@/components/portal/settings-tabs";
import { ReadOnlyBadge } from "@/components/portal/read-only-badge";
import { TeamPermissionFields } from "@/components/portal/team/permission-fields";
import { EditPermissionsDialog } from "@/components/portal/team/edit-permissions-dialog";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, canViewModule, getSessionUser } from "@/supabase/auth";
import {
  DEFAULT_EMPTY_PERMISSIONS,
  DEFAULT_SUPER_ADMIN_PERMISSIONS,
  type AdminPermissionsMap,
  type AdminRolePreset,
  type UserRole,
} from "@/supabase/types";
import { matchPreset, PRESET_LABELS, summarizePermissions } from "@/lib/admin-permissions";
import { extractYouTubeId, youTubeEmbedUrl } from "@/lib/youtube";
import {
  inviteTeamMember,
  resendTeamInvite,
  revokeTeamInvite,
} from "../actions";
import { setHomeVideo } from "./actions";

export const metadata = pageMetadata("Settings", "Your account, site settings, and team.");
export const dynamic = "force-dynamic";

const inputCls =
  "flex-1 rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

interface InviteRow {
  id: string;
  email: string;
  role: UserRole;
  admin_role: string | null;
  permissions: AdminPermissionsMap | null;
  created_at: string;
  expires_at: string;
}

interface AdminProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  admin_role: string | null;
  permissions: AdminPermissionsMap | null;
}

// The access map + preset + human summary to DISPLAY for a stored (admin_role,
// permissions) pair. Mirrors getAdminPermissions: a null map or "super_admin"
// role means full access.
function resolveDisplay(adminRole: string | null, permissions: AdminPermissionsMap | null) {
  const isSuper = adminRole === "super_admin" || !permissions;
  const perms: AdminPermissionsMap = isSuper
    ? DEFAULT_SUPER_ADMIN_PERMISSIONS
    : { ...DEFAULT_EMPTY_PERMISSIONS, ...permissions };
  const preset: AdminRolePreset = isSuper ? "super_admin" : matchPreset(perms);
  const summary = isSuper ? "Full access to all sections" : summarizePermissions(perms);
  return { perms, preset, summary };
}

export default async function AdminSettings() {
  const supabase = await createClient();
  const user = await getSessionUser();
  const canManageTeam = await canManageModule("team");
  const canViewTeam = await canViewModule("team");

  const [{ data: videoSetting }, { data: inviteData }, { data: adminData }] =
    await Promise.all([
      supabase
        .from("site_settings")
        .select("value")
        .eq("key", "home_video_url")
        .maybeSingle(),
      canViewTeam
        ? supabase
            .from("team_invites")
            .select("id, email, role, admin_role, permissions, created_at, expires_at")
            .is("accepted_at", null)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as InviteRow[] }),
      canViewTeam
        ? supabase
            .from("profiles")
            .select("id, email, full_name, admin_role, permissions")
            .eq("role", "admin")
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as AdminProfile[] }),
    ]);

  const videoUrl = (videoSetting?.value as string | null) ?? "";
  const videoId = videoUrl ? extractYouTubeId(videoUrl) : null;
  const invites = (inviteData ?? []) as InviteRow[];
  const admins = (adminData ?? []) as AdminProfile[];

  const accountTab = <AccountSettings showHeading={false} />;

  const videoTab = (
    <Card className="p-5 space-y-4">
      <p className="text-sm text-muted-foreground">
        A YouTube video shown on the portal home page for all users — students and
        educators. Leave the field empty and save to remove it.
      </p>
      {canManageTeam ? (
        <form action={setHomeVideo} className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            name="url"
            defaultValue={videoUrl}
            placeholder="https://www.youtube.com/watch?v=…"
            className={inputCls}
          />
          <ConfirmSubmitButton
            size="sm"
            variant="outline"
            title="Save home page video?"
            description="This changes (or removes) the video every portal user sees on their home page."
            confirmLabel="Yes, save"
          >
            Save
          </ConfirmSubmitButton>
        </form>
      ) : (
        <ReadOnlyBadge />
      )}
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
    <div className="space-y-6">
      {/* ── Invite (managers only) ─────────────────────────────────────── */}
      {canManageTeam ? (
        <Card className="p-5 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Invite a teammate as an admin and choose what they can see and do.
              They&apos;ll get a secure link to set their password; the account is
              verified automatically. If the email already has an account, its access
              is updated right away.
            </p>
          </div>
          <form action={inviteTeamMember} className="space-y-4">
            <input
              type="email"
              name="email"
              required
              placeholder="teammate@example.com"
              className={`${inputCls} w-full`}
            />
            <TeamPermissionFields
              defaultPreset="super_admin"
              defaultPermissions={DEFAULT_SUPER_ADMIN_PERMISSIONS}
            />
            <SubmitButton size="sm" variant="outline" pendingText="Sending…">
              Send invite
            </SubmitButton>
          </form>
        </Card>
      ) : (
        <Card className="p-5 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            You can view the team but not invite members or change access.
          </p>
          <ReadOnlyBadge />
        </Card>
      )}

      {/* ── Active team members ────────────────────────────────────────── */}
      {admins.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {admins.length} team member{admins.length === 1 ? "" : "s"}
          </p>
          {admins.map((a) => {
            const { preset, perms, summary } = resolveDisplay(a.admin_role, a.permissions);
            const name = a.full_name ?? a.email ?? "Unknown";
            return (
              <Card
                key={a.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <span className="font-medium text-foreground">{name}</span>
                  {a.id === user?.id ? (
                    <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                      you
                    </span>
                  ) : null}
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {PRESET_LABELS[preset]}
                    </span>{" "}
                    · {summary}
                  </p>
                </div>
                {canManageTeam && a.id !== user?.id ? (
                  <EditPermissionsDialog
                    profileId={a.id}
                    memberName={name}
                    preset={preset}
                    permissions={perms}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* ── Pending invites ────────────────────────────────────────────── */}
      {invites.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {invites.length} pending invite{invites.length === 1 ? "" : "s"}
          </p>
          {invites.map((inv) => {
            const { preset, summary } = resolveDisplay(inv.admin_role, inv.permissions);
            return (
              <Card
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <span className="text-foreground font-medium">{inv.email}</span>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {PRESET_LABELS[preset]}
                    </span>{" "}
                    · {summary}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                {canManageTeam ? (
                  <div className="flex gap-2">
                    <form action={resendTeamInvite.bind(null, inv.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="outline"
                        title="Resend this invite?"
                        description={`A fresh invite link is generated and emailed to ${inv.email}. The old link stops working.`}
                        confirmLabel="Yes, resend"
                      >
                        Resend
                      </ConfirmSubmitButton>
                    </form>
                    <form action={revokeTeamInvite.bind(null, inv.id)}>
                      <ConfirmSubmitButton
                        size="sm"
                        variant="outline"
                        destructive
                        title="Revoke this invite?"
                        description={`${inv.email} will no longer be able to join with this link.`}
                        confirmLabel="Yes, revoke"
                      >
                        Revoke
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );

  const tabs = [
    { label: "Your account", content: accountTab },
    ...(canViewTeam ? [{ label: "Home page video", content: videoTab }] : []),
    ...(canViewTeam ? [{ label: "Team", content: teamTab }] : []),
  ];

  return (
    <>
      <PortalHeader title="Settings" subtitle={user?.email ?? undefined} />
      <PortalBody>
        <SettingsTabs tabs={tabs} />
      </PortalBody>
    </>
  );
}
