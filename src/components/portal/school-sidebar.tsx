"use client";

import { LayoutDashboard, ClipboardList, Users, ListChecks, Award } from "lucide-react";
import PortalSidebar, { type SidebarConfig, type NavLink } from "@/components/portal/portal-sidebar";

const OVERVIEW: NavLink = { href: "/portal/school", label: "Overview", icon: LayoutDashboard, exact: true, short: "Home" };
const REGISTRATIONS: NavLink = { href: "/portal/school/registrations", label: "Registrations", icon: ClipboardList, short: "Regs" };
const STUDENTS: NavLink = { href: "/portal/school/students", label: "Students", icon: Users };
const PLANS: NavLink = { href: "/portal/school/plans", label: "Learning plans", icon: ListChecks, short: "Plans" };
const RESULTS: NavLink = { href: "/portal/school/results", label: "Results", icon: Award };

const CONFIG: SidebarConfig = {
  ariaLabel: "School sections",
  overview: OVERVIEW,
  groups: [{ title: "Manage", links: [REGISTRATIONS, STUDENTS, PLANS, RESULTS] }],
  bottom: [OVERVIEW, REGISTRATIONS, STUDENTS, PLANS, RESULTS],
};

export default function SchoolSidebar() {
  return <PortalSidebar config={CONFIG} />;
}
