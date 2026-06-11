import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import {
  getParticipantsTableId,
  isAirtableConfigured,
  listAirtableRecords,
} from "@/lib/airtable";

export const metadata = pageMetadata("Participants", "Registrations from Airtable.");
export const dynamic = "force-dynamic";

interface ParticipantFields {
  "School Full Name"?: string;
  "School LGA"?: string;
  "School Category"?: string;
  "Principal Full Name"?: string;
  "Principal Email Address"?: string;
  "Student Rep 1 Full Name"?: string;
  "Student Rep 2 Full Name"?: string;
  "Student Rep 3 Full Name"?: string;
}

export default async function AdminParticipants() {
  if (!isAirtableConfigured()) {
    return (
      <>
        <PortalHeader title="Participants" subtitle="Registrations from Airtable" />
        <PortalBody>
          <EmptyState title="Airtable not connected">
            Add a real Airtable token (`AIRTABLE_API_TOKEN`, starts with “pat…”)
            to your .env, then restart the dev server to load participants here.
          </EmptyState>
        </PortalBody>
      </>
    );
  }

  let records: { id: string; fields: ParticipantFields }[] = [];
  let error: string | null = null;
  try {
    records = await listAirtableRecords<ParticipantFields>(
      getParticipantsTableId(),
    );
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load participants.";
  }

  return (
    <>
      <PortalHeader title="Participants" subtitle="Registrations from Airtable" />
      <PortalBody>
        <div>
          <SectionHeading>
            {records.length} participant{records.length === 1 ? "" : "s"}
          </SectionHeading>
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : records.length === 0 ? (
            <EmptyState title="No participants yet">
              Submitted registrations from the public form will appear here.
            </EmptyState>
          ) : (
            <Card className="divide-y divide-[#0A0F1E]/5">
              {records.map((rec) => {
                const f = rec.fields;
                const reps = [
                  f["Student Rep 1 Full Name"],
                  f["Student Rep 2 Full Name"],
                  f["Student Rep 3 Full Name"],
                ].filter(Boolean);
                return (
                  <div key={rec.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-medium text-[#0A0F1E]">
                        {f["School Full Name"] ?? "—"}
                      </span>
                      <span className="text-sm text-[#4A4E5C] whitespace-nowrap">
                        {[f["School LGA"], f["School Category"]]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                    {reps.length ? (
                      <p className="text-sm text-[#4A4E5C] mt-1">
                        Reps: {reps.join(", ")}
                      </p>
                    ) : null}
                    {f["Principal Full Name"] ? (
                      <p className="text-sm text-[#4A4E5C]">
                        Principal: {f["Principal Full Name"]}
                        {f["Principal Email Address"]
                          ? ` · ${f["Principal Email Address"]}`
                          : ""}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </PortalBody>
    </>
  );
}
