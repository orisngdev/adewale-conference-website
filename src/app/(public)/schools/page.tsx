import { unstable_cache } from "next/cache";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import { pageMetadata } from "@/lib/seo";
import {
  type AirtableRecord,
  getSchoolDatabaseTableId,
  listAirtableRecords,
  type SchoolRecordFields,
} from "@/lib/airtable";

export const metadata = pageMetadata(
  "Participating Schools",
  "Schools competing in the Adewale Students Conference across Ogun State's local governments.",
);

// Source of truth is Airtable (same table the registration flow writes to).
// Email is intentionally excluded from the public directory. The Airtable lib
// fetches with no-store, so wrap the read in a 5-minute cache to keep the page
// static-ish and avoid hitting Airtable on every request.
const loadSchools = unstable_cache(
  async () => {
    const params = new URLSearchParams();
    for (const field of [
      "School Name",
      "School Category",
      "School Local Government Area",
      "School Address",
    ]) {
      params.append("fields[]", field);
    }
    params.set("sort[0][field]", "School Name");
    params.set("sort[0][direction]", "asc");
    return listAirtableRecords<SchoolRecordFields>(getSchoolDatabaseTableId(), params);
  },
  ["schools-directory"],
  { revalidate: 300 },
);

async function getSchools(): Promise<AirtableRecord<SchoolRecordFields>[]> {
  try {
    return await loadSchools();
  } catch (error) {
    console.error("Schools directory fetch failed:", error);
    return [];
  }
}

function groupByLga(records: AirtableRecord<SchoolRecordFields>[]) {
  const map = new Map<string, AirtableRecord<SchoolRecordFields>[]>();
  for (const record of records) {
    if (!record.fields["School Name"]) continue;
    const lga = record.fields["School Local Government Area"]?.trim() || "Other";
    const list = map.get(lga) ?? [];
    list.push(record);
    map.set(lga, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export default async function SchoolsPage() {
  const schools = await getSchools();
  const groups = groupByLga(schools);
  const total = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <>
      <PageHeader
        kicker="Community"
        title="Participating Schools"
        subtitle="Schools competing across Ogun State's local government areas."
      />
      <section className="px-6 md:px-12 py-16 md:py-20">
        <div className="max-w-5xl mx-auto">
          {total === 0 ? (
            <EmptyState title="No schools listed yet">
              Registered schools will be listed here as registrations come in.
            </EmptyState>
          ) : (
            <>
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-[#4A4E5C] mb-8">
                {total} school{total === 1 ? "" : "s"} across {groups.length} LGA
                {groups.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-10">
                {groups.map(([lga, list]) => (
                  <div key={lga}>
                    <h2 className="font-bebas text-2xl text-[#0A0F1E] mb-3">{lga}</h2>
                    <ul className="grid gap-px bg-[rgba(10,15,30,0.12)] border border-[rgba(10,15,30,0.12)] list-none">
                      {list.map((school) => (
                        <li
                          key={school.id}
                          className="bg-white p-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                        >
                          <span className="font-bold text-[#0A0F1E]">
                            {school.fields["School Name"]}
                          </span>
                          {school.fields["School Category"] ? (
                            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-[#4A4E5C]">
                              {school.fields["School Category"]}
                            </span>
                          ) : null}
                          {school.fields["School Address"] ? (
                            <span className="text-sm text-[#4A4E5C] basis-full">
                              {school.fields["School Address"]}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
