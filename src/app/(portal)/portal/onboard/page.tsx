import Link from "next/link";
import OnboardForm from "@/components/portal/onboard-form";
import OnboardResendForm from "@/components/portal/onboard-resend-form";
import { pageMetadata } from "@/lib/seo";
import { createAdminClient } from "@/supabase/admin";

export const metadata = pageMetadata(
  "Activate your account",
  "Activate your school's coordinator account.",
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

export default async function OnboardPage({
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
          <p>Onboarding isn&apos;t configured yet — please contact the organisers.</p>
        </Message>
      </Shell>
    );
  }

  const { data: reg } = token
    ? await admin
        .from("registrations")
        .select(
          "id, contact_email, contact_name, owner_id, onboarded_at, verify_token_expires_at, edition_year, schools(name)",
        )
        .eq("verify_token", token)
        .maybeSingle()
    : { data: null };

  // Per-educator token (e.g. the principal's own activation link).
  const { data: member } =
    token && !reg
      ? await admin
          .from("school_members")
          .select("id, email, full_name, profile_id, onboarded_at, verify_token_expires_at, schools(name)")
          .eq("verify_token", token)
          .maybeSingle()
      : { data: null };

  if (!token || (!reg && !member)) {
    return (
      <Shell>
        <Message title={token ? "Link not recognised" : "Activate your account"}>
          <p>
            {token
              ? "This activation link is invalid or has already been used."
              : "Registered your school? Get your activation link below."}{" "}
            If you&apos;ve already activated,{" "}
            <Link href="/portal/login" className="text-primary hover:underline not-italic font-medium">
              sign in here
            </Link>
            . Signed up with a different email? Use your claim code on the{" "}
            <Link href="/portal/claim" className="text-primary hover:underline not-italic font-medium">
              claim page
            </Link>
            .
          </p>
        </Message>
        <div className="mt-8 pt-6 border-t border-foreground/10">
          <OnboardResendForm />
        </div>
      </Shell>
    );
  }

  const alreadyActive = reg
    ? Boolean(reg.owner_id || reg.onboarded_at)
    : Boolean(member?.profile_id || member?.onboarded_at);
  if (alreadyActive) {
    return (
      <Shell>
        <Message title="Already active">
          <p>
            This account is already set up —{" "}
            <Link href="/portal/login" className="text-primary hover:underline not-italic font-medium">
              sign in
            </Link>{" "}
            to see your school and your students&apos; access codes.
          </p>
        </Message>
      </Shell>
    );
  }

  const expiresAt = (reg?.verify_token_expires_at ?? member?.verify_token_expires_at) as
    | string
    | null;
  if (expiresAt && new Date(expiresAt) < new Date()) {
    return (
      <Shell>
        <Message title="Link expired">
          <p>
            Activation links are valid for 30 days and this one has expired —
            request a fresh one below.
          </p>
        </Message>
        <div className="mt-8 pt-6 border-t border-foreground/10">
          <OnboardResendForm />
        </div>
      </Shell>
    );
  }

  const schoolName =
    ((reg?.schools ?? member?.schools) as unknown as { name: string | null } | null)?.name ??
    "your school";
  const email = ((reg?.contact_email ?? member?.email) as string | null) ?? "";

  return (
    <Shell>
      <h1 className="font-bebas text-5xl text-foreground leading-none">
        Welcome, coach
      </h1>
      <p className="serif-display italic text-muted-foreground mt-3 mb-8 leading-relaxed">
        Set a password to activate your coordinator account for{" "}
        <span className="not-italic font-medium text-foreground">{schoolName}</span>
        {reg ? ` (${reg.edition_year} edition)` : ""}. Your students&apos; login codes
        will be waiting inside.
      </p>
      <OnboardForm token={token} email={email} />
    </Shell>
  );
}
