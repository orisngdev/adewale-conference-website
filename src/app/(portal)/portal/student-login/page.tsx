import Link from "next/link";
import StudentLoginForm from "@/components/portal/student-login-form";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata(
  "Student sign-in",
  "Sign in to the portal with the access code from your school.",
);

export default function StudentLoginPage() {
  return (
    <section className="px-6 py-16 md:py-24 min-h-[70vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white border border-[#0A0F1E]/10 shadow-[0_4px_40px_rgba(10,15,30,0.08)] p-8 md:p-10">
        <span className="inline-block border border-[#E8A020] bg-[rgba(232,160,32,0.08)] px-3 py-1.5 mb-6 text-[10px] font-bold tracking-[0.25em] uppercase text-[#E8A020]">
          Student
        </span>
        <h1 className="font-bebas text-5xl text-[#0A0F1E] leading-none">
          Student sign-in
        </h1>
        <p className="serif-display italic text-[#4A4E5C] mt-3 mb-8 leading-relaxed">
          Enter the access code your school coordinator gave you — no email or
          password needed.
        </p>
        <StudentLoginForm />
        <p className="mt-6 text-sm text-[#4A4E5C]">
          Coordinator or staff?{" "}
          <Link href="/portal/login" className="text-[#E8A020] hover:underline font-medium">
            Sign in here
          </Link>
        </p>
      </div>
    </section>
  );
}
