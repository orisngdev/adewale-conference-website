"use client";

import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Monitor,
  Trophy,
  Lightbulb,
  ListChecks,
  Award,
  FolderDown,
  School,
  Settings,
} from "lucide-react";
import PortalSidebar, { type SidebarConfig, type NavLink } from "@/components/portal/portal-sidebar";

const OVERVIEW: NavLink = { href: "/portal/student", label: "Overview", icon: LayoutDashboard, exact: true, short: "Home" };
const PRACTICE: NavLink = { href: "/portal/student/practice", label: "Practice", icon: BookOpen };
const EXAMS: NavLink = { href: "/portal/student/exams", label: "Exams", icon: ClipboardCheck };
const TECH_LAB: NavLink = { href: "/portal/student/tech-lab", label: "Tech Lab", icon: Monitor };
const CHALLENGES: NavLink = { href: "/portal/student/challenges", label: "Challenges", icon: Trophy };
const PITCH: NavLink = { href: "/portal/student/pitch-studio", label: "Pitch Studio", icon: Lightbulb };
const PLANS: NavLink = { href: "/portal/student/plans", label: "My plans", icon: ListChecks, short: "Plans" };
const RESULTS: NavLink = { href: "/portal/student/results", label: "Results", icon: Award };
const RESOURCES: NavLink = { href: "/portal/student/resources", label: "Resources", icon: FolderDown };
const SCHOOL: NavLink = { href: "/portal/student/school", label: "My school", icon: School, short: "School" };
const SETTINGS: NavLink = { href: "/portal/student/settings", label: "Settings", icon: Settings };

const CONFIG: SidebarConfig = {
  ariaLabel: "Student sections",
  overview: OVERVIEW,
  groups: [
    { title: "Learn", links: [PRACTICE, EXAMS, TECH_LAB, CHALLENGES, PITCH] },
    { title: "You", links: [PLANS, RESULTS, SCHOOL, RESOURCES, SETTINGS] },
  ],
  bottom: [OVERVIEW, PRACTICE, EXAMS, PLANS],
  more: [TECH_LAB, CHALLENGES, PITCH, RESULTS, SCHOOL, RESOURCES, SETTINGS],
};

export default function StudentSidebar() {
  return <PortalSidebar config={CONFIG} />;
}
