"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Users,
  ListChecks,
  Award,
  FolderDown,
  Settings,
} from "lucide-react";
import PortalSidebar, { type SidebarConfig, type NavLink } from "@/components/portal/portal-sidebar";

const OVERVIEW: NavLink = { href: "/portal/school", label: "Overview", icon: LayoutDashboard, exact: true, short: "Home" };
const REGISTRATIONS: NavLink = { href: "/portal/school/registrations", label: "Registrations", icon: ClipboardList, short: "Regs" };
const STUDENTS: NavLink = { href: "/portal/school/students", label: "Students", icon: Users };
const PLANS: NavLink = { href: "/portal/school/plans", label: "Learning plans", icon: ListChecks, short: "Plans" };
const RESULTS: NavLink = { href: "/portal/school/results", label: "Results", icon: Award };
const RESOURCES: NavLink = { href: "/portal/school/resources", label: "Resources", icon: FolderDown };
const SETTINGS: NavLink = { href: "/portal/school/settings", label: "Settings", icon: Settings };

const CONFIG: SidebarConfig = {
  ariaLabel: "School sections",
  overview: OVERVIEW,
  groups: [
    { title: "Manage", links: [REGISTRATIONS, STUDENTS, PLANS, RESULTS, RESOURCES] },
    { title: "You", links: [SETTINGS] },
  ],
  bottom: [OVERVIEW, REGISTRATIONS, STUDENTS, PLANS],
  more: [RESULTS, RESOURCES, SETTINGS],
};

export default function SchoolSidebar() {
  return <PortalSidebar config={CONFIG} />;
}
