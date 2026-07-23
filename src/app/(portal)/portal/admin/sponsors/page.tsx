import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
  StatTile,
} from "@/components/portal/ui";
import {
  FilterBar,
  Pagination,
  filterSelectCls,
  parsePage,
} from "@/components/portal/list-controls";
import { pageMetadata } from "@/lib/seo";
import {
  getSponsorshipTableId,
  listAirtableRecords,
  type AirtableRecord,
} from "@/lib/airtable";
import { SPONSORSHIP_TIER_OPTIONS } from "@/lib/forms";
import { requireModuleView } from "@/supabase/auth";

export const metadata = pageMetadata("Sponsors", "Sponsorship enquiries from the public form.");
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface SponsorFields {
  "Organisation Name"?: string;
  "Contact Person"?: string;
  "Email Address"?: string;
  "Phone Number"?: string;
  "Sponsorship Tier Of Interest"?: string;
  Message?: string;
}

// Colour the tier badge by its leading word (Platinum/Gold/Silver/Bronze/…).
function tierClass(tier: string) {
  const key = tier.split(/[\s-]/)[0].toLowerCase();
  switch (key) {
    case "platinum":
      return "bg-slate-200 text-slate-800";
    case "gold":
      return "bg-amber-100 text-amber-800";
    case "silver":
      return "bg-zinc-100 text-zinc-700";
    case "bronze":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-primary/[0.14] text-gold-ink";
  }
}

export default async function AdminSponsors({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; page?: string }>;
  }) {
  await requireModuleView("team");
  const { q, tier, page: pageParam } = await searchParams;

  // Pulled live from the Airtable Sponsorship table — the same table the public
  // "Become a sponsor" form writes to (like registrations).
  let records: AirtableRecord<SponsorFields>[] = [];
  let airtableError = false;
  try {
    records = await listAirtableRecords<SponsorFields>(getSponsorshipTableId());
  } catch {
    airtableError = true;
  }

  const all = records
    .map((r) => ({
      id: r.id,
      org: (r.fields["Organisation Name"] ?? "").trim(),
      contact: (r.fields["Contact Person"] ?? "").trim(),
      email: (r.fields["Email Address"] ?? "").trim(),
      phone: (r.fields["Phone Number"] ?? "").trim(),
      tier: (r.fields["Sponsorship Tier Of Interest"] ?? "").trim(),
      message: (r.fields["Message"] ?? "").trim(),
      createdTime: r.createdTime,
    }))
    // Newest enquiry first.
    .sort((a, b) => (a.createdTime < b.createdTime ? 1 : -1));

  const needle = (q ?? "").trim().toLowerCase();
  const filtered = all.filter((s) => {
    if (tier && s.tier !== tier) return false;
    if (!needle) return true;
    return [s.org, s.contact, s.email, s.phone].some((v) =>
      v.toLowerCase().includes(needle),
    );
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(parsePage(pageParam), pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Tier tallies over everything (not the current filter).
  const byTier = new Map<string, number>();
  for (const s of all) byTier.set(s.tier, (byTier.get(s.tier) ?? 0) + 1);

  return (
    <>
      <PortalHeader
        title="Sponsors"
        subtitle="Sponsorship enquiries from the public form (synced from Airtable)"
      />
      <PortalBody>
        {airtableError ? (
          <Card className="p-4 border-l-4 border-l-red-500">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-600">
              Airtable not reachable
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Set <span className="font-mono">AIRTABLE_API_TOKEN</span>,{" "}
              <span className="font-mono">AIRTABLE_BASE_ID</span> and{" "}
              <span className="font-mono">AIRTABLE_SPONSORSHIP_TABLE_ID</span> to load
              sponsorship enquiries.
            </p>
          </Card>
        ) : null}

        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatTile label="Enquiries" value={all.length} />
          <StatTile
            label="Platinum / Gold"
            value={[...byTier.entries()]
              .filter(([t]) => /^(platinum|gold)/i.test(t))
              .reduce((n, [, c]) => n + c, 0)}
          />
          <StatTile label="Tiers" value={byTier.size} />
          <StatTile label="Matches" value={filtered.length} />
        </div>

        <div>
          <SectionHeading>Enquiries</SectionHeading>

          <FilterBar q={q} placeholder="Search organisation, contact, email…">
            <select name="tier" defaultValue={tier ?? ""} className={filterSelectCls}>
              <option value="">Any tier</option>
              {SPONSORSHIP_TIER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </FilterBar>

          {rows.length === 0 ? (
            <EmptyState title={needle || tier ? "No matches" : "No enquiries yet"}>
              {needle || tier
                ? "No sponsorship enquiries match the current search or filter."
                : "Enquiries from the public “Become a sponsor” form will appear here."}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              {rows.map((s) => (
                <Card key={s.id} className="p-5 md:p-6 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <span className="font-bebas text-2xl text-foreground">
                        {s.org || "Unnamed organisation"}
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {s.contact || "—"}
                        {s.email ? (
                          <>
                            {" · "}
                            <a href={`mailto:${s.email}`} className="text-primary hover:underline">
                              {s.email}
                            </a>
                          </>
                        ) : null}
                        {s.phone ? ` · ${s.phone}` : ""}
                      </p>
                    </div>
                    {s.tier ? (
                      <span
                        className={`inline-flex items-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shrink-0 ${tierClass(s.tier)}`}
                      >
                        {s.tier}
                      </span>
                    ) : null}
                  </div>

                  {s.message ? (
                    <p className="text-sm text-muted-foreground border-t border-foreground/5 pt-3">
                      {s.message}
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          )}

          <Pagination
            page={page}
            pageCount={pageCount}
            path="/portal/admin/sponsors"
            params={{ q, tier }}
          />
        </div>
      </PortalBody>
    </>
  );
}
