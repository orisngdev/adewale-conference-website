import { redirect } from "next/navigation";
import { Card, SectionHeading } from "@/components/portal/ui";
import BmcBoard from "@/components/portal/bmc-board";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { DESIGN_STAGES, PITCH_LINKS } from "@/lib/pitch-studio";

export const metadata = pageMetadata("Pitch Studio", "Design thinking & business model canvas.");
export const dynamic = "force-dynamic";

export default async function PitchStudio() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data: canvas } = await supabase
    .from("pitch_canvas")
    .select("data")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  const initial = (canvas?.data ?? {}) as Record<string, { id: string; text: string }[]>;

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Innovation &amp; Pitch Studio</SectionHeading>
        <p className="serif-display italic text-muted-foreground">
          Turn empathy for your community into a viable solution — then pitch it.
        </p>
      </div>

      <div>
        <SectionHeading>Design Thinking</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {DESIGN_STAGES.map((s, i) => (
            <Card key={s.key} className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Step {i + 1}</p>
              <p className="font-bebas text-lg text-foreground">{s.title}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading>Business Model Canvas</SectionHeading>
        <BmcBoard initial={initial} />
      </div>

      <div>
        <SectionHeading>Toolkits</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          {PITCH_LINKS.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="block group">
              <Card interactive className="p-4 h-full">
                <p className="font-bebas text-lg text-foreground">{l.title} ↗</p>
                <p className="text-sm text-muted-foreground mt-1">{l.note}</p>
              </Card>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
