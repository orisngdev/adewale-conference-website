import Link from "next/link";
import TeamInviteForm from "@/components/portal/team-invite-form";
import { pageMetadata } from "@/lib/seo";
import { createAdminClient } from "@/supabase/admin";

export const metadata = pageMetadata(
  "Accept your invitation",
  "Join the ASC portal team.",
);
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="px-6 py-16 md:py-24 min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.08)] p-8 md:p-10">
        <span className="inline-block border border-primary bg-primary/[0.08] px-3 py-1.5 mb-6 text-[10px] font-bold tracking-[0.25em] uppercase text-primary">
          Portal
        </span>
        {children}
      </div>
    </section>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h1 className="font-bebas text-5xl text-foreground leading-none">{title}</h1>
      <div className="serif-display italic text-muted-foreground mt-3 leading-relaxed">
        {children}
      </div>
    </>
  );
}

export default async function TeamInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const admin = createAdminClient();

  if (!admin) {
    return (
      <Shell>
        <Message title="Not available">
          <p>Invitations aren&apos;t configured yet — please contact the organisers.</p>
        </Message>
      </Shell>
    );
  }

  const { data: invite } = token
    ? await admin
        .from("team_invites")
        .select("id, email, accepted_at, expires_at")
        .eq("verify_token", token)
        .maybeSingle()
    : { data: null };

  if (!token || !invite) {
    return (
      <Shell>
        <Message title="Link not recognised">
          <p>
            This invitation link is invalid or has already been used. If you&apos;ve
            already activated,{" "}
            <Link href="/portal/login" className="text-primary hover:underline not-italic font-medium">
              sign in here
            </Link>
            . Otherwise ask the team to resend your invitation.
          </p>
        </Message>
      </Shell>
    );
  }

  if (invite.accepted_at) {
    return (
      <Shell>
        <Message title="Already active">
          <p>
            This invitation was already accepted —{" "}
            <Link href="/portal/login" className="text-primary hover:underline not-italic font-medium">
              sign in
            </Link>{" "}
            with your password.
          </p>
        </Message>
      </Shell>
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return (
      <Shell>
        <Message title="Invitation expired">
          <p>
            Invitations are valid for 30 days and this one has expired — ask the
            team to resend it and you&apos;ll get a fresh link.
          </p>
        </Message>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="font-bebas text-5xl text-foreground leading-none">
        Welcome to the team
      </h1>
      <p className="serif-display italic text-muted-foreground mt-3 mb-8 leading-relaxed">
        Set a password to activate your admin account — your email is already
        verified by this link, so you&apos;ll be signed in right away.
      </p>
      <TeamInviteForm token={token} email={invite.email as string} />
    </Shell>
  );
}
