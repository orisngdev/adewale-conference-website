import type { Rep } from "@/supabase/types";
import { ageFromDob } from "@/lib/age";

// Full entry details for a registration. The data lives in `registrations.details`
// (jsonb) keyed by the Airtable field names — populated by the live mirror on
// submission and refreshed by the Airtable sync. Rendered read-only for admins so
// they can review each student (gender, class, DOB, guardian) and the school's
// principal / coordinating teacher without leaving the portal.

type Details = Record<string, string> | null | undefined;

function val(details: Details, key: string): string {
  const v = details?.[key];
  return typeof v === "string" ? v.trim() : "";
}

/** One "label: value" pair; renders nothing when the value is blank. */
function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground break-words">{value}</dd>
    </div>
  );
}

function GenderPill({ gender }: { gender: string }) {
  if (!gender) return null;
  const female = gender.toLowerCase().startsWith("f");
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        female ? "bg-primary/15 text-gold-ink" : "bg-foreground/10 text-muted-foreground"
      }`}
    >
      {gender}
    </span>
  );
}

interface StudentEntry {
  n: number;
  name: string;
  gender: string;
  klass: string;
  dob: string;
  guardianName: string;
  guardianNumber: string;
}

/** Compact "2F · 1M" summary of the reps' gender split (blank if unknown). */
export function genderMix(details: Details): string {
  let f = 0;
  let m = 0;
  for (const n of [1, 2, 3]) {
    if (!val(details, `Student Rep ${n} Full Name`)) continue;
    const g = val(details, `Student Rep ${n} Gender`).toLowerCase();
    if (g.startsWith("f")) f += 1;
    else if (g.startsWith("m")) m += 1;
  }
  if (f === 0 && m === 0) return "";
  return [f ? `${f}F` : null, m ? `${m}M` : null].filter(Boolean).join(" · ");
}

export function RegistrationDetails({
  details,
  reps,
}: {
  details: Details;
  reps: Rep[];
}) {
  // Prefer the rich `details`; fall back to the bare reps array (name + class)
  // that every registration carries, so pre-sync rows still show something.
  const students: StudentEntry[] = [1, 2, 3]
    .map((n) => ({
      n,
      name: val(details, `Student Rep ${n} Full Name`),
      gender: val(details, `Student Rep ${n} Gender`),
      klass: val(details, `Student Rep ${n} Class`),
      dob: val(details, `Student Rep ${n} DOB`),
      guardianName: val(details, `Student Rep ${n} Guardian Name`),
      guardianNumber: val(details, `Student Rep ${n} Guardian Number`),
    }))
    .filter((s) => s.name);

  const fallbackStudents: StudentEntry[] =
    students.length === 0
      ? reps.map((r, i) => ({
          n: i + 1,
          name: r.name,
          gender: "",
          klass: r.level ?? "",
          dob: "",
          guardianName: "",
          guardianNumber: "",
        }))
      : students;

  const teacherName = val(details, "Teacher Full Name");
  const teacherGender = val(details, "Teacher Gender");
  const teacherPhone = val(details, "Teacher Number");
  const teacherEmail = val(details, "Teacher Email Address");
  const principalName = val(details, "Principal Full Name");
  const principalGender = val(details, "Principal Gender");
  const principalPhone = val(details, "Principal Number");
  const principalEmail = val(details, "Principal Email Address");

  const lga = val(details, "School LGA");
  const category = val(details, "School Category");
  const address = val(details, "School Address");
  const schoolEmail = val(details, "School Email Address");
  const zonal = val(details, "Zonal Finals Location");
  const participatedLast = val(details, "School Participated In Last Edition");
  const hearAbout = val(details, "Hear About Adewale");

  const hasContacts = teacherName || principalName;
  const hasSchoolMeta =
    lga || category || address || schoolEmail || zonal || participatedLast || hearAbout;

  return (
    <details className="border-t border-foreground/5 pt-3 group">
      <summary className="cursor-pointer select-none text-xs font-bold uppercase tracking-wide text-muted-foreground hover:text-foreground">
        Full entry details ({fallbackStudents.length} student
        {fallbackStudents.length === 1 ? "" : "s"})
      </summary>

      <div className="mt-3 space-y-5">
        {/* ── Students ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Student representatives
          </p>
          <div className="divide-y divide-foreground/5 border border-foreground/10">
            {fallbackStudents.map((s) => (
              <div key={s.n} className="p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{s.name}</span>
                  <GenderPill gender={s.gender} />
                  {s.klass ? (
                    <span className="text-xs text-muted-foreground">{s.klass}</span>
                  ) : null}
                </div>
                {s.dob || s.guardianName || s.guardianNumber ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                    <Field label="Date of birth" value={s.dob} />
                    <Field
                      label="Age"
                      value={(() => {
                        const age = ageFromDob(s.dob);
                        return age != null ? `${age} yrs` : "";
                      })()}
                    />
                    <Field label="Guardian" value={s.guardianName} />
                    <Field label="Guardian phone" value={s.guardianNumber} />
                  </dl>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* ── Coordinating teacher + principal ─────────────────────── */}
        {hasContacts ? (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              School contacts
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {teacherName ? (
                <div className="border border-foreground/10 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Coordinating teacher
                    </span>
                    <GenderPill gender={teacherGender} />
                  </div>
                  <dl className="space-y-2">
                    <Field label="Name" value={teacherName} />
                    <Field label="Phone" value={teacherPhone} />
                    <Field label="Email" value={teacherEmail} />
                  </dl>
                </div>
              ) : null}
              {principalName ? (
                <div className="border border-foreground/10 p-3 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Principal
                    </span>
                    <GenderPill gender={principalGender} />
                  </div>
                  <dl className="space-y-2">
                    <Field label="Name" value={principalName} />
                    <Field label="Phone" value={principalPhone} />
                    <Field label="Email" value={principalEmail} />
                  </dl>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ── School meta ──────────────────────────────────────────── */}
        {hasSchoolMeta ? (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              School
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 border border-foreground/10 p-3">
              <Field label="LGA" value={lga} />
              <Field label="Category" value={category} />
              <Field label="Zonal finals" value={zonal} />
              <Field label="Address" value={address} />
              <Field label="School email" value={schoolEmail} />
              <Field label="Participated last edition" value={participatedLast} />
              <Field label="Heard about ASC via" value={hearAbout} />
            </dl>
          </div>
        ) : null}
      </div>
    </details>
  );
}
