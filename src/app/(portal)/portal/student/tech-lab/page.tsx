import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, SectionHeading } from "@/components/portal/ui";
import TechLabProgress from "@/components/portal/tech-lab-progress";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";
import { TECH_LAB_IDE_URL, TECH_LAB_LINKS } from "@/lib/tech-lab";

export const metadata = pageMetadata("Tech Skills Lab", "Scratch to Python and data.");
export const dynamic = "force-dynamic";

export default async function TechLab() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data } = await supabase
    .from("tech_lab_progress")
    .select("step_key")
    .eq("student_user_id", user.id);
  const done = ((data ?? []) as { step_key: string }[]).map((r) => r.step_key);

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Future Tech Skills Lab</SectionHeading>
        <p className="serif-display italic text-muted-foreground">
          From Scratch blocks to Python and data — build the skills behind AI and software engineering.
        </p>
      </div>

      <Link href="/portal/student/challenges" className="block group">
        <Card interactive className="p-5 flex items-center justify-between gap-4 border-l-4 border-l-primary">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">New · Data challenges</p>
            <p className="font-bebas text-2xl text-foreground leading-tight">Compete on real datasets</p>
            <p className="text-sm text-muted-foreground">Like Zindi &amp; Kaggle — download data, predict, and climb a live leaderboard.</p>
          </div>
          <span className="shrink-0 text-primary font-bold">Enter →</span>
        </Card>
      </Link>

      <TechLabProgress initialDone={done} />

      <div>
        <SectionHeading>Code right here</SectionHeading>
        <Card className="p-2 overflow-hidden">
          <iframe
            src={TECH_LAB_IDE_URL}
            title="Browser Python IDE"
            className="w-full h-[440px] rounded"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        </Card>
        <p className="text-xs text-muted-foreground mt-1">
          Runs in your browser — no install. If it doesn&apos;t load, use the links below.
        </p>
      </div>

      <div>
        <SectionHeading>More practice</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-3">
          {TECH_LAB_LINKS.map((l) => (
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
