"use client";

import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  ClipboardCheck,
  FileQuestion,
  Users,
  School,
  UserRound,
  HandCoins,
} from "lucide-react";
import PortalSidebar, { type SidebarConfig, type NavLink } from "@/components/portal/portal-sidebar";

const OVERVIEW: NavLink = { href: "/portal/admin", label: "Overview", icon: LayoutDashboard, exact: true, short: "Home" };
const EDITIONS: NavLink = { href: "/portal/admin/editions", label: "Editions", icon: CalendarDays };
const REGISTRATIONS: NavLink = { href: "/portal/admin/registrations", label: "Registrations", icon: ClipboardList, short: "Regs" };
const ASSESSMENTS: NavLink = { href: "/portal/admin/assessments", label: "Assessments", icon: ClipboardCheck, short: "Tests" };
const QUESTION_BANK: NavLink = { href: "/portal/admin/question-bank", label: "Question bank", icon: FileQuestion, short: "Bank" };
const USERS: NavLink = { href: "/portal/admin/users", label: "Users", icon: Users };
const SCHOOLS: NavLink = { href: "/portal/admin/schools", label: "Schools", icon: School };
const PARTICIPANTS: NavLink = { href: "/portal/admin/participants", label: "Participants", icon: UserRound, short: "People" };
const SPONSORS: NavLink = { href: "/portal/admin/sponsors", label: "Sponsors", icon: HandCoins };

const CONFIG: SidebarConfig = {
  ariaLabel: "Admin sections",
  overview: OVERVIEW,
  groups: [
    { title: "Program", links: [EDITIONS, REGISTRATIONS, ASSESSMENTS, QUESTION_BANK] },
    { title: "People", links: [USERS, SCHOOLS, PARTICIPANTS, SPONSORS] },
  ],
  bottom: [OVERVIEW, REGISTRATIONS, ASSESSMENTS, USERS],
  more: [EDITIONS, QUESTION_BANK, SCHOOLS, PARTICIPANTS, SPONSORS],
};

export default function AdminNav() {
  return <PortalSidebar config={CONFIG} />;
}
