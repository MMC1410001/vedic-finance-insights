/**
 * The six sections of /admin, declared exactly once.
 *
 * The sidebar, the mobile pills, the scroll-spy observer and the `<section id>`
 * anchors all derive from this array. The /kundali page keeps four separate
 * copies of its equivalent list — the sidebar's own array, two more inside
 * FinancialKundali.tsx, and the literal ids in JSX — and they have already
 * drifted: the sidebar says "Best Financial Timings" where the heading says
 * "Your Best Financial Timings". One array avoids that.
 *
 * Its own module rather than living in AdminSidebar.tsx so the hook can import
 * it without pulling a component in, and so Fast Refresh keeps working
 * (react-refresh wants component files to export only components).
 */

import { Activity, BarChart3, Globe, ScrollText, Sparkles, Users } from "lucide-react";

export const ADMIN_SECTIONS = [
  // Overview is operational health — is the funnel populated, is data still
  // flowing. Analytics is behaviour — what people do and where they stop. They
  // were one section until the second grew a dashboard of its own; keeping them
  // merged meant "is the pipeline alive" and "why is checkout leaking" competed
  // for the same screen.
  { id: "admin-overview", label: "Overview", icon: Activity },
  { id: "admin-analytics", label: "Analytics", icon: BarChart3 },
  { id: "admin-ips", label: "IP Addresses", icon: Globe },
  { id: "admin-kundalis", label: "Admin Kundalis", icon: Sparkles },
  { id: "admin-user-kundalis", label: "Kundalis Generated", icon: ScrollText },
  { id: "admin-users", label: "Users", icon: Users },
] as const;

export type AdminSectionId = (typeof ADMIN_SECTIONS)[number]["id"];
