import { redirect } from "next/navigation";
import { FUTURE_TECH_SLUG } from "@/lib/labs";

// The Tech Lab is now the seeded "future-tech" Guided Lab. Keep old links working.
export default function TechLabRedirect() {
  redirect(`/portal/student/labs/${FUTURE_TECH_SLUG}`);
}
