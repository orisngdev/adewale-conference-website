import { Suspense } from "react";
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
      <div className="w-full max-w-md bg-white border border-[#0A0F1E]/10 shadow-[0_4px_40px_rgba(10,15,30,0.08)] p-8 md:p-10">
        <span className="inline-block border border-[#E8A020] bg-[rgba(232,160,32,0.08)] px-3 py-1.5 mb-6 text-[10px] font-bold tracking-[0.25em] uppercase text-[#E8A020]">
          Portal
        </span>
        <h1 className="font-bebas text-5xl text-[#0A0F1E] leading-none">
          Sign in
        </h1>
        <p className="serif-display italic text-[#4A4E5C] mt-3 mb-8 leading-relaxed">
          Schools, students, and staff — access your dashboard with a one-time
          email link. No password to remember.
        </p>

        {isSupabaseConfigured ? (
          <Suspense>
            <LoginForm />
          </Suspense>
        ) : (
          <p className="serif-display italic text-[#4A4E5C]">
            The portal isn&apos;t connected yet — add your Supabase project keys
            to enable sign-in.
          </p>
        )}
      </div>
    </section>
  );
}
