import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, EmptyState, SectionHeading } from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import { isSupabaseConfigured } from "@/supabase/env";

export const metadata = pageMetadata("My plans", "Your assigned learning plans.");
export const dynamic = "force-dynamic";

export default async function StudentPlans() {
  if (!isSupabaseConfigured) redirect("/portal/login");
  const supabase = await createClient();
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");

  const { data } = await supabase.rpc("get_my_plans");
  const plans = (data ?? []) as {
    id: string;
    title: string;
    description: string | null;
    subject: string | null;
    level: string | null;
  }[];

  return (
    <div>
      <SectionHeading>My learning plans</SectionHeading>
      {plans.length === 0 ? (
        <EmptyState title="No plans assigned yet — your teacher will set one up for you." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <Link key={p.id} href={`/portal/student/plans/${p.id}`} className="block group">
              <Card interactive className="p-5 h-full">
                <h4 className="font-bebas text-xl text-foreground">{p.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {[p.subject, p.level].filter(Boolean).join(" · ") || "Study plan"}
                </p>
                {p.description ? <p className="text-sm text-muted-foreground mt-2">{p.description}</p> : null}
                <p className="mt-3 text-xs uppercase tracking-[0.2em] text-primary">Open plan →</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
