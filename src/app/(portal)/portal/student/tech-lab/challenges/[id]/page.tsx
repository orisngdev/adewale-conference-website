import { redirect } from "next/navigation";

// Challenges moved to their own top-level section; keep old links working.
export default async function LegacyChallengeDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/portal/student/challenges/${id}`);
}
