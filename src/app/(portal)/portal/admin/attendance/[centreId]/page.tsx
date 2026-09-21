import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { canManageModule, requireModuleView } from "@/supabase/auth";
import { Card, EmptyState, PortalBody, PortalHeader, StatTile } from "@/components/portal/ui";
import ActionForm from "@/components/portal/action-form";
import {
  attendanceCounts,
  latestEventByStudent,
  markerName,
  type AttendanceEvent,
} from "@/lib/attendance";
import { loadSitting, openAttendanceExam } from "@/lib/attendance-data";
import type { ExamCentre } from "@/supabase/types";
import { correctMark } from "../actions";

export const metadata = pageMetadata("Centre attendance", "Who was marked, and by whom.");
export const dynamic = "force-dynamic";

export default async function CentreAttendance({
  params,
}: {
  params: Promise<{ centreId: string }>;
}) {
  await requireModuleView("participants");
  const canManage = await canManageModule("participants");
  const { centreId } = await params;
  const supabase = await createClient();

  const { data: centre, error: centreError } = await supabase
    .from("exam_centres")
    .select("id, edition_year, name, town, legacy_zone, is_active")
    .eq("id", centreId)
    .maybeSingle();
  if (centreError) throw new Error(centreError.message);
  if (!centre) notFound();
  const venue = centre as ExamCentre;

  const exam = await openAttendanceExam();
  if (!exam) {
    return (
      <>
        <PortalHeader title={`${venue.name}, ${venue.town}`} />
        <PortalBody>
          <EmptyState title="No sitting is open">
            Open attendance on the exam being sat before this page can show a register.
          </EmptyState>
          <Link href="/portal/admin/attendance" className="text-sm text-gold-ink hover:underline">
            ← Back to attendance
          </Link>
        </PortalBody>
      </>
    );
  }

  const { entries } = await loadSitting(exam);
  const mine = entries.filter((e) => e.centreId === venue.id);
  const counts = attendanceCounts(mine);

  // The latest event per student tells us who said so. One query for the centre,
  // newest first, then first-seen wins.
  const { data: eventRows, error: eventsError } = await supabase
    .from("paper_exam_attendance_events")
    .select("student_id, status, at, centre_leads(name), profiles(full_name, email)")
    .eq("exam_id", exam.id)
    .eq("centre_id", venue.id)
    .order("at", { ascending: false });
  if (eventsError) throw new Error(eventsError.message);

  const latest = latestEventByStudent((eventRows ?? []) as unknown as AttendanceEvent[]);

  return (
    <>
      <PortalHeader
        title={`${venue.name}, ${venue.town}`}
        subtitle={`${exam.title} · ${counts.total} candidates allocated`}
      />
      <PortalBody>
        <Link href="/portal/admin/attendance" className="text-sm text-gold-ink hover:underline">
          ← Back to attendance
        </Link>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Present" value={String(counts.present)} />
          <StatTile label="Absent" value={String(counts.absent)} />
          <StatTile label="Not marked" value={String(counts.unmarked)} />
        </div>

        {mine.length === 0 ? (
          <EmptyState title="No candidates here">
            No school is allocated to this venue.
            {venue.legacy_zone
              ? ""
              : " It is new for 2026, so no stored centre name reaches it — move schools here by hand from the attendance page."}
          </EmptyState>
        ) : (
          <Card className="divide-y divide-foreground/5 p-0">
            {mine.map((entry) => {
              const event = latest.get(entry.studentId);
              const who = markerName(event);
              return (
                <div
                  key={entry.studentId}
                  className="grid gap-2 px-4 py-3 lg:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-center"
                >
                  <span className="font-bebas text-xl tabular-nums text-foreground">
                    {entry.examNo}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{entry.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{entry.schoolName}</p>
                  </div>
                  <div className="min-w-0 text-xs text-muted-foreground">
                    {entry.state === "unmarked" ? (
                      <span className="text-gold-ink">Not marked</span>
                    ) : (
                      <>
                        <span
                          className={
                            entry.state === "present"
                              ? "font-bold text-foreground"
                              : "font-bold text-destructive"
                          }
                        >
                          {entry.state === "present" ? "Present" : "Absent"}
                        </span>
                        {who ? ` · marked by ${who}` : ""}
                        {event ? ` · ${new Date(event.at).toLocaleTimeString("en-GB")}` : ""}
                      </>
                    )}
                  </div>
                  {canManage ? (
                    <ActionForm action={correctMark} className="flex gap-1.5">
                      <input type="hidden" name="exam_id" value={exam.id} />
                      <input type="hidden" name="student_id" value={entry.studentId} />
                      <input type="hidden" name="centre_id" value={venue.id} />
                      <button
                        type="submit"
                        name="status"
                        value="present"
                        className="min-h-9 cursor-pointer rounded-md border border-foreground/20 px-2 text-xs font-bold"
                      >
                        Present
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="absent"
                        className="min-h-9 cursor-pointer rounded-md border border-foreground/20 px-2 text-xs font-bold"
                      >
                        Absent
                      </button>
                    </ActionForm>
                  ) : null}
                </div>
              );
            })}
          </Card>
        )}
      </PortalBody>
    </>
  );
}
