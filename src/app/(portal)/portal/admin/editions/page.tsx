import { Button } from "@/components/ui/button";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { EditionStages } from "@/components/portal/edition-stages";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import type { Edition } from "@/supabase/types";
import { createEdition, setEditionStage, toggleRegistration } from "./actions";

export const metadata = pageMetadata("Editions", "Open registration and advance stages.");
export const dynamic = "force-dynamic";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export default async function AdminEditions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("editions")
    .select("year, title, registration_open, stages, current_stage")
    .order("year", { ascending: false });
  const editions = (data ?? []) as Edition[];

  return (
    <>
      <PortalHeader
        title="Editions"
        subtitle="Open registration and advance the stage for each year"
      />
      <PortalBody>
        <div>
          <SectionHeading>Editions</SectionHeading>
          {editions.length === 0 ? (
            <p className="serif-display italic text-muted-foreground">
              No editions yet — add one below.
            </p>
          ) : (
            <div className="space-y-6">
              {editions.map((e) => (
                <Card key={e.year} className="p-5 md:p-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bebas text-2xl text-foreground">
                        {e.year}
                      </span>
                      {e.title ? (
                        <p className="text-sm text-muted-foreground">{e.title}</p>
                      ) : null}
                    </div>
                    <form
                      action={toggleRegistration.bind(
                        null,
                        e.year,
                        !e.registration_open,
                      )}
                    >
                      <Button
                        type="submit"
                        size="sm"
                        variant={e.registration_open ? "default" : "outline"}
                      >
                        {e.registration_open
                          ? "Registration open — close"
                          : "Open registration"}
                      </Button>
                    </form>
                  </div>

                  <EditionStages stages={e.stages} current={e.current_stage} />

                  <form
                    action={setEditionStage.bind(null, e.year)}
                    className="flex gap-2"
                  >
                    <select
                      name="stage"
                      defaultValue={e.current_stage}
                      className={inputCls}
                    >
                      {e.stages.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">
                      Set current stage
                    </Button>
                  </form>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionHeading>Add an edition</SectionHeading>
          <Card className="p-5 md:p-6">
            <form
              action={createEdition}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                name="year"
                type="number"
                required
                placeholder="Year (e.g. 2027)"
                className={`sm:w-40 ${inputCls}`}
              />
              <input
                name="title"
                placeholder="Theme (optional)"
                className={`flex-1 ${inputCls}`}
              />
              <Button type="submit" size="sm">
                Add edition
              </Button>
            </form>
          </Card>
        </div>
      </PortalBody>
    </>
  );
}
