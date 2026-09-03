/**
 * One section of the admin panel: the scroll anchor the sidebar targets, plus a
 * chapter-style heading so the nav label appears on the page too.
 *
 * Deliberately does NOT own a collapse toggle. Every block inside already has
 * one (PipelineHealth's diagnostics, VisitorSessions, GenerateTempKundali,
 * AllKundaliList), and a second chevron wrapping the first is how you end up
 * with two ways to hide the same table. The heading is styled as an eyebrow —
 * small, uppercase, with a hairline rule — precisely so it reads as a divider
 * above those blocks rather than competing with their own <h2>s.
 */

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminSection({
  id,
  label,
  icon: Icon,
  description,
  children,
  className,
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      // Mobile clears the sticky pill strip (~52px); desktop only needs
      // breathing room. scroll-margin is what makes scrollIntoView land right,
      // so these two numbers are load-bearing, not cosmetic.
      className={cn("scroll-mt-[68px] lg:scroll-mt-6 mb-10 sm:mb-12", className)}
    >
      <div className="flex items-center gap-3 mb-4">
        <Icon className="w-4 h-4 text-admin-text-muted shrink-0" />
        <h2
          id={`${id}-heading`}
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-admin-text-secondary whitespace-nowrap"
        >
          {label}
        </h2>
        <span className="h-px flex-1 bg-admin-border-subtle" aria-hidden="true" />
      </div>

      {description && <p className="text-xs text-admin-text-muted -mt-2 mb-4">{description}</p>}

      {children}
    </section>
  );
}
