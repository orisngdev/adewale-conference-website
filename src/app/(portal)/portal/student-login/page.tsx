import Link from "next/link";
import { redirect } from "next/navigation";
import StudentLoginForm from "@/components/portal/student-login-form";
import { authenticatedLoginRedirect } from "@/lib/portal-login-redirect";
import { pageMetadata } from "@/lib/seo";
import { getSessionUser, getUserRole } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata(
  "Student sign-in",
  "Sign in to the portal with the access code from your school.",
);

export default async function StudentLoginPage() {
  if (isSupabaseConfigured) {
    const user = await getSessionUser();
    const target = authenticatedLoginRedirect(
      user,
      "/portal",
      user ? await getUserRole() : null,
    );
    if (target) redirect(target);
  }

  return (
    <section className="px-6 py-16 md:py-24 min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.08)] p-8 md:p-10">
        <span className="inline-block border border-primary bg-primary/[0.08] px-3 py-1.5 mb-6 text-[10px] font-bold tracking-[0.25em] uppercase text-primary">
          Student
        </span>
        <h1 className="font-bebas text-5xl text-foreground leading-none">
          Student sign-in
        </h1>
        <p className="serif-display italic text-muted-foreground mt-3 mb-8 leading-relaxed">
          Enter the access code your school coordinator gave you — no email or
          password needed.
        </p>
        <StudentLoginForm />
        <p className="mt-6 text-sm text-muted-foreground">
          Coordinator or staff?{" "}
          <Link href="/portal/login" className="text-primary hover:underline font-medium">
            Sign in here
          </Link>
        </p>
      </div>
    </section>
  );
}
