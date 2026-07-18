"use client";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  FileQuestion,
  FlaskConical,
  FolderDown,
  Hourglass,
  Trophy,
  Users,
  School,
  UserRound,
  UserRoundCheck,
  HandCoins,
  Settings,
} from "lucide-react";
import PortalSidebar, { type SidebarConfig, type NavLink } from "@/components/portal/portal-sidebar";

const OVERVIEW: NavLink = { href: "/portal/admin", label: "Overview", icon: LayoutDashboard, exact: true, short: "Home" };
const EDITIONS: NavLink = { href: "/portal/admin/editions", label: "Editions", icon: CalendarDays };
const REGISTRATIONS: NavLink = { href: "/portal/admin/registrations", label: "Registrations", icon: ClipboardList, short: "Regs" };
const WAITLIST: NavLink = { href: "/portal/admin/waitlist", label: "Waitlist", icon: Hourglass, short: "Wait" };
const ASSESSMENTS: NavLink = { href: "/portal/admin/assessments", label: "Assessments", icon: ClipboardCheck, short: "Tests" };
const LABS: NavLink = { href: "/portal/admin/labs", label: "Labs", icon: FlaskConical };
const CHALLENGES: NavLink = { href: "/portal/admin/challenges", label: "Challenges", icon: Trophy, short: "Arena" };
const QUESTION_BANK: NavLink = { href: "/portal/admin/question-bank", label: "Question bank", icon: FileQuestion, short: "Bank" };
const RESOURCES: NavLink = { href: "/portal/admin/resources", label: "Resources", icon: FolderDown, short: "Guides" };
const USERS: NavLink = { href: "/portal/admin/users", label: "Users", icon: Users };
const SCHOOLS: NavLink = { href: "/portal/admin/schools", label: "Schools", icon: School };
const PARTICIPANTS: NavLink = { href: "/portal/admin/participants", label: "Participants", icon: UserRound, short: "People" };
const REPLACEMENTS: NavLink = { href: "/portal/admin/replacements", label: "Replacements", icon: UserRoundCheck, short: "Swaps" };
const SPONSORS: NavLink = { href: "/portal/admin/sponsors", label: "Sponsors", icon: HandCoins };
const SETTINGS: NavLink = { href: "/portal/admin/settings", label: "Settings", icon: Settings };

const CONFIG: SidebarConfig = {
  ariaLabel: "Admin sections",
  overview: OVERVIEW,
  groups: [
    { title: "Program", links: [EDITIONS, REGISTRATIONS, WAITLIST, ASSESSMENTS, LABS, CHALLENGES, QUESTION_BANK, RESOURCES] },
    { title: "People", links: [PARTICIPANTS, REPLACEMENTS, USERS, SCHOOLS, SPONSORS] },
    { title: "Site", links: [SETTINGS] },
  ],
  bottom: [OVERVIEW, REGISTRATIONS, ASSESSMENTS, USERS],
  more: [PARTICIPANTS, REPLACEMENTS, EDITIONS, WAITLIST, LABS, CHALLENGES, QUESTION_BANK, RESOURCES, SCHOOLS, SPONSORS, SETTINGS],
};

export default function AdminNav() {
  return <PortalSidebar config={CONFIG} />;
}
