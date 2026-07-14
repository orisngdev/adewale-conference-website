import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import PageHeader from "@/components/layout/page-header";
import EmptyState from "@/components/ui/empty-state";
import { pageMetadata } from "@/lib/seo";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/supabase/env";

export const metadata = pageMetadata(
  "Participating Schools",
  "Schools competing in the Adewale Students Conference across Ogun State's local governments.",
);

interface SchoolRow {
  id: string;
  name: string;
  lga: string | null;
  category: string | null;
  address: string | null;
}

// Reads the portal's schools table (kept complete by the Airtable sync) with
// the public anon key. Email is intentionally excluded from the directory.
// Cached for 5 minutes to keep the page static-ish.
const loadSchools = unstable_cache(
  async (): Promise<SchoolRow[]> => {
    if (!isSupabaseConfigured) return [];
    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, lga, category, address")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as SchoolRow[];
  },
  ["schools-directory"],
  { revalidate: 300 },
);

async function getSchools(): Promise<SchoolRow[]> {
  try {
    return await loadSchools();
  } catch (error) {
    console.error("Schools directory fetch failed:", error);
    return [];
  }
}

function groupByLga(schools: SchoolRow[]) {
  const map = new Map<string, SchoolRow[]>();
  for (const school of schools) {
    if (!school.name) continue;
    const lga = school.lga?.trim() || "Other";
    const list = map.get(lga) ?? [];
    list.push(school);
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
              <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-muted-foreground mb-8">
                {total} school{total === 1 ? "" : "s"} across {groups.length} LGA
                {groups.length === 1 ? "" : "s"}
              </p>
              <div className="space-y-10">
                {groups.map(([lga, list]) => (
                  <div key={lga}>
                    <h2 className="font-bebas text-2xl text-foreground mb-3">{lga}</h2>
                    <ul className="grid gap-px bg-[rgba(10,15,30,0.12)] border border-[rgba(10,15,30,0.12)] list-none">
                      {list.map((school) => (
                        <li
                          key={school.id}
                          className="bg-white p-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"
                        >
                          <span className="font-bold text-foreground">{school.name}</span>
                          {school.category ? (
                            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground">
                              {school.category}
                            </span>
                          ) : null}
                          {school.address ? (
                            <span className="text-sm text-muted-foreground basis-full">
                              {school.address}
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
