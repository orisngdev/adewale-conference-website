import Link from "next/link";
import { openAttendanceExam } from "@/lib/attendance-data";

/**
 * The way centre staff reach their register — on the page they already know.
 *
 * Shows only while an exam is open for attendance, so the public site is not
 * advertising a staff tool for the other 364 days. A failure to read that flag
 * renders nothing: the Fellows page is marketing and must not break because the
 * attendance migrations have not been pushed yet.
 */
export default async function AttendanceBanner() {
  let open = null;
  try {
    open = await openAttendanceExam();
  } catch {
    return null;
  }
  if (!open) return null;

  return (
    <section className="bg-secondary px-5 py-5 md:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
            <span className="inline-block size-2 rounded-full bg-primary" aria-hidden="true" />
            Exam day is live
          </p>
          <p className="mt-1 text-lg font-bold text-secondary-foreground">
            Staffing a centre today?
          </p>
          <p className="text-sm text-secondary-foreground/80">
            Sign in with the email the exam desk registered for you.
          </p>
        </div>
        <Link
          href="/attendance"
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-base font-bold text-primary-foreground"
        >
          Open your centre register →
        </Link>
      </div>
    </section>
  );
}
