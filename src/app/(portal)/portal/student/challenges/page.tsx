import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("Data challenges", "Compete on real datasets.");
export const dynamic = "force-dynamic";

export default async function Challenges() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  const supabase = await createClient();

  const { data } = await supabase
    .from("challenges")
    .select("id, title, metric, deadline")
    .eq("published", true)
    .order("created_at", { ascending: false });
  const challenges = (data ?? []) as {
    id: string;
    title: string;
    metric: string;
    deadline: string | null;
  }[];

  return (
    <div className="space-y-6">
      <div>
        <SectionHeading>Data challenges</SectionHeading>
        <p className="serif-display italic text-muted-foreground">
          Real datasets, a live leaderboard — like Zindi &amp; Kaggle, built for you. Download the
          data, make your predictions, and climb the board.
        </p>
      </div>

      {challenges.length === 0 ? (
        <EmptyState title="No challenges are open yet — check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {challenges.map((c) => (
            <Link key={c.id} href={`/portal/student/challenges/${c.id}`} className="block group">
              <Card interactive className="p-5 h-full">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  {c.metric}
                </span>
                <h4 className="font-bebas text-xl text-foreground mt-1">{c.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {c.deadline ? `Closes ${new Date(c.deadline).toLocaleDateString()}` : "Open challenge"}
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-primary">Enter →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
