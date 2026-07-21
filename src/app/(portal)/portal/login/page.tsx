import { Suspense } from "react";
import Link from "next/link";
import LoginForm from "@/components/portal/login-form";
import { isSupabaseConfigured } from "@/supabase/env";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Sign in",
  "Sign in to the Adewale Students Conference portal.",
);

export default function LoginPage() {
  return (
    <section className="px-6 py-16 md:py-24 min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-card border border-foreground/10 shadow-[0_4px_40px_rgba(10,15,30,0.08)] p-8 md:p-10">
        <span className="inline-block border border-primary bg-primary/[0.08] px-3 py-1.5 mb-6 text-[10px] font-bold tracking-[0.25em] uppercase text-primary">
          Portal
        </span>
        <h1 className="font-bebas text-5xl text-foreground leading-none">
          Portal access
        </h1>
        <p className="serif-display italic text-muted-foreground mt-3 mb-8 leading-relaxed">
          Schools, students, and staff — sign in with your email and password.
          If your account is active but you need access, request a one-time email
          link and set a new password.
        </p>

        {isSupabaseConfigured ? (
          <>
            <Suspense>
              <LoginForm />
            </Suspense>
            <p className="mt-6 text-sm text-muted-foreground">
              Student?{" "}
              <Link
                href="/portal/student-login"
                className="text-primary hover:underline font-medium"
              >
                Sign in with your access code
              </Link>
            </p>
          </>
        ) : (
          <p className="serif-display italic text-muted-foreground">
            The portal isn&apos;t connected yet — add your Supabase project keys
            to enable sign-in.
          </p>
        )}
      </div>
    </section>
  );
}
