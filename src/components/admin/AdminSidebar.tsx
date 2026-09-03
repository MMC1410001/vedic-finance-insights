/**
 * Section navigation for /admin.
 *
 * The panel used to be one undifferentiated scroll of seven blocks. These two
 * components — a pinned sidebar on desktop, a sticky pill strip on phones —
 * jump to the five sections defined by ADMIN_SECTIONS below.
 *
 * Visually this mirrors KundaliSidebar (same icon-chip rows, same 2px active
 * marker, same collapse chevron) but shares none of its code, for one concrete
 * reason: KundaliSidebar paints every colour with inline styles from
 * useKundaliTheme(), and /admin deliberately does not load the Vedic stylesheet
 * (see the comment on the wrapper div in Admin.tsx). The admin panel has its own
 * complete `--admin-*` token set for both themes, so plain Tailwind classes
 * theme correctly here and inline colours would not.
 */

import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Link } from "react-router-dom";
import vedicfinanceLogo from "@/assets/vedicfinance-logo.webp";
import { cn } from "@/lib/utils";
import { ADMIN_SECTIONS, type AdminSectionId } from "./admin-sections";

interface NavProps {
  active: string;
  onSelect: (id: AdminSectionId) => void;
}

/** Desktop: pinned, collapsible to icons. Hidden below lg. */
export function AdminSidebar({
  active,
  onSelect,
  collapsed,
  onToggleCollapse,
}: NavProps & { collapsed: boolean; onToggleCollapse: () => void }) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 sticky top-6 self-start max-h-[calc(100vh-3rem)]",
        "rounded-xl border border-admin-border bg-admin-surface overflow-hidden transition-[width] duration-300",
        collapsed ? "w-[64px]" : "w-[212px]",
      )}
    >
      {/* Logo — matches the kundali sidebar so the two pages read as one product */}
      <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-admin-border-subtle">
        <Link
          to="/"
          className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
          title="Back to VedicFinance"
        >
          <img
            src={vedicfinanceLogo}
            alt="VedicFinance"
            className={cn("object-contain shrink-0", collapsed ? "h-7 w-7 mx-auto" : "h-7 w-7")}
            loading="lazy"
            decoding="async"
          />
          {!collapsed && (
            <span className="text-sm font-bold tracking-tight text-admin-text truncate">VedicFinance</span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            aria-label="Collapse section menu"
            className="p-1 rounded text-admin-text-muted hover:text-admin-text hover:bg-admin-surface-2 transition-colors shrink-0"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggleCollapse}
          aria-label="Expand section menu"
          className="mx-auto mt-2 p-1 rounded text-admin-text-muted hover:text-admin-text hover:bg-admin-surface-2 transition-colors"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      )}

      <nav aria-label="Admin sections" className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-0.5">
        {ADMIN_SECTIONS.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              aria-current={isActive ? "true" : undefined}
              title={collapsed ? section.label : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg border-l-2 transition-colors text-left",
                isActive
                  ? "border-l-admin-info bg-admin-surface-2"
                  : "border-l-transparent hover:bg-admin-surface-2/60",
                collapsed && "justify-center px-0",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center w-6 h-6 rounded-md shrink-0 transition-colors",
                  isActive && "bg-admin-info/15",
                )}
              >
                <section.icon
                  className={cn("h-[15px] w-[15px]", isActive ? "text-admin-info" : "text-admin-text-muted")}
                />
              </span>
              {!collapsed && (
                <span
                  className={cn(
                    "text-[13px] font-medium truncate",
                    isActive ? "text-admin-text" : "text-admin-text-secondary",
                  )}
                >
                  {section.label}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/**
 * Phones and tablets: a one-line strip pinned under the viewport top.
 *
 * A drawer was the other option — it is what /kundali does — but it costs two
 * taps per jump and hides the section list until tapped, on the device where
 * scrolling past four sections hurts most. `bg-admin-bg` is not optional: the
 * strip sits over scrolling table content.
 */
export function AdminSectionPills({ active, onSelect }: NavProps) {
  return (
    <nav
      aria-label="Admin sections"
      className="lg:hidden sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-5 bg-admin-bg border-b border-admin-border-subtle"
    >
      {/* scrollbar-none is not available here, so the bar is simply left visible
          on platforms that draw one — preferable to clipping "Users" off. */}
      <div className="flex gap-1.5 overflow-x-auto">
        {ADMIN_SECTIONS.map((section) => {
          const isActive = active === section.id;
          return (
            <button
              key={section.id}
              onClick={() => onSelect(section.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3 min-h-[44px] lg:min-h-[36px] rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0 border",
                isActive
                  ? "bg-admin-info-strong text-white border-transparent"
                  : "bg-admin-surface text-admin-text-muted border-admin-border-subtle hover:text-admin-text",
              )}
            >
              <section.icon className="h-3.5 w-3.5 shrink-0" />
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
