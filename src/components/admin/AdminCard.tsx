/**
 * The panel's standard surface. This shell (`bg-… border … rounded-xl`) was
 * repeated ~30 times across Admin.tsx and PipelineHealth.tsx with small
 * inconsistencies; centralising it is what made the theme migration tractable.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminCard({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Tag className={cn("rounded-xl border border-admin-border bg-admin-surface", className)}>
      {children}
    </Tag>
  );
}

/**
 * Status badge — a rounded label that must never break across lines.
 *
 * Why this exists rather than a `rounded-full` span at each site: a **plain
 * inline** element that breaks over two lines has its border-radius applied at
 * each line fragment's own boundaries, so it renders as two half-pills stacked on
 * top of each other. That was reported as "the awaiting payment pill looks cut in
 * half", and it was reachable from every badge site in the panel — all ~35 of
 * them were bare inline spans.
 *
 * `inline-flex` is the fix, and the reason is specific: it makes the badge an
 * **atomic** inline box, which line breaking cannot split at all. It also centres
 * its own content, where an inline span rides low on the text baseline in a table
 * cell.
 *
 * `whitespace-nowrap` is belt-and-braces, not the cure — worth being precise
 * about, because it looks like the obvious answer and is not. Inside a flex
 * container the text is a flex item whose `min-width: auto` floors it at
 * min-content, so the label overflows rather than wrapping however narrow the box
 * gets; no width can make an inline-flex pill's label break. The class earns its
 * place only if a caller adds `min-w-0` or a second child, and it costs nothing.
 * e2e/admin-responsive.spec.ts asserts the display property for exactly this
 * reason — two earlier versions of that test measured nowrap instead and passed
 * with the fix removed.
 *
 * `tone` carries the colour pair (background + text), because those are chosen
 * per meaning at the call site — `bg-admin-warn/20 text-admin-warn` and so on.
 *
 * For a badge whose label is genuinely long and open-ended, prefer `wrap` — see
 * the note on that prop.
 */
export function Pill({
  tone,
  size = "sm",
  title,
  wrap = false,
  className,
  children,
}: {
  /** Colour pair, e.g. `bg-admin-ok/20 text-admin-ok`. */
  tone?: string;
  /**
   * The three scales already in use across the panel, kept exact so this
   * component could replace ~35 hand-written spans without shifting any of them
   * visually. `className` still wins over the size (cn is tailwind-merge), which
   * is how the handful of px-1.5 chips keep their tighter padding.
   */
  size?: "sm" | "md" | "lg";
  title?: string;
  /**
   * Allow wrapping — and then round the corners rather than the line fragments,
   * so a multi-line badge still reads as one shape.
   *
   * Only for labels that are both long and outside our control. A nowrap pill is
   * the right default: it keeps the shape intact and the column simply widens.
   */
  wrap?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center font-medium",
        // rounded-full on a wrapping box makes lens shapes out of the middle
        // lines, so a wrapping pill takes a fixed radius instead.
        wrap ? "rounded-lg text-left" : "whitespace-nowrap rounded-full",
        size === "sm"
          ? "text-[10px] px-2 py-0.5"
          : size === "md"
            ? "text-xs px-2 py-0.5"
            : "text-xs px-2.5 py-1",
        tone,
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Metric tile: big value over a small label. */
export function AdminStat({
  value,
  label,
  tone = "text-admin-text",
  className,
  children,
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <AdminCard className={cn("p-4", className)}>
      {children}
      <p className={cn("text-2xl font-bold", tone)}>{value}</p>
      <p className="text-xs text-admin-text-muted mt-1">{label}</p>
    </AdminCard>
  );
}
