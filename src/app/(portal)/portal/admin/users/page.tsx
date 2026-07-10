import EmptyState from "@/components/ui/empty-state";
import {
  Card,
  PortalBody,
  PortalHeader,
  SectionHeading,
} from "@/components/portal/ui";
import { pageMetadata } from "@/lib/seo";
import { createClient } from "@/supabase/server";
import { getSessionUser } from "@/supabase/auth";
import type { UserRole } from "@/supabase/types";

export const metadata = pageMetadata("Users", "Everyone with a portal account.");
export const dynamic = "force-dynamic";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export default async function AdminUsers() {
  const supabase = await createClient();
  const user = await getSessionUser();

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at")
    .order("created_at", { ascending: false });

  const profiles = (data ?? []) as ProfileRow[];

  return (
    <>
      <PortalHeader
        title="Users"
        subtitle="Everyone with a portal account. Invite admins from Settings."
      />
      <PortalBody>
        <div>
          <SectionHeading>{profiles.length} user{profiles.length === 1 ? "" : "s"}</SectionHeading>
          {profiles.length === 0 ? (
            <EmptyState title="No users yet">
              Users appear here after they sign in for the first time.
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {profiles.map((p) => (
                <Card
                  key={p.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
                >
                  <div>
                    <span className="text-foreground font-medium">
                      {p.full_name ?? p.email ?? "Unknown"}
                    </span>
                    {p.id === user?.id ? (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                        you
                      </span>
                    ) : null}
                    {p.full_name && p.email ? (
                      <p className="text-sm text-muted-foreground">{p.email}</p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground capitalize">
                      {p.role}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      Joined {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </PortalBody>
    </>
  );
}
