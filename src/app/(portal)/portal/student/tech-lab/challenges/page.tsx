import { redirect } from "next/navigation";

// Challenges moved to their own top-level section; keep old links working.
export default function LegacyChallenges() {
  redirect("/portal/student/challenges");
}
