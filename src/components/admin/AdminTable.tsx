/**
 * Responsive table shell for the admin panel.
 *
 * The three tables here carry 7-9 columns and need ~800px; a 375px phone gives
 * them 327px. They were previously wrapped in `overflow-hidden`, which *clips*
 * rather than scrolls — so on a phone the right-hand columns rendered but were
 * physically unreachable, including "Delete user" and "Make admin". Routing all
 * three through this component means the layout contract is written once and
 * that class of bug cannot come back:
 *
 *   >= sm : real table, horizontally scrollable if it still overflows
 *   <  sm : one card per row, so every action stays reachable without scrolling
 *
 * Sorting is opt-in per column: give a column a `sortValue` and its header
 * becomes a three-state toggle (first direction, opposite, off). The <sm layout
 * has no headers to click, so it gets a select-and-direction bar instead.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AdminCard } from "./AdminCard";
import { MobileSortBar, SortHeader } from "./TableSortControls";
import { ariaSort, useTableSort, type SortState, type Sortable } from "./table-sort";

export interface AdminColumn<T> {
  label: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
  /** Supply to make this column sortable. Omit for "#" and "Actions". */
  sortValue?: (row: T) => Sortable;
  /** Start descending — right for dates and counts, where "newest"/"most" is the useful end. */
  descFirst?: boolean;
  /** Plain-text name for the mobile sort picker. Required when `label` is JSX. */
  sortLabel?: string;
}

export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  renderRow,
  renderCard,
  maxHeightClass,
  stickyHeader = false,
  defaultSort,
}: {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  /** Desktop: must return the <td> cells for one row (not the <tr>). */
  renderRow: (row: T, i: number) => ReactNode;
  /** Mobile: the full card body for one row. */
  renderCard: (row: T, i: number) => ReactNode;
  maxHeightClass?: string;
  stickyHeader?: boolean;
  defaultSort?: SortState;
}) {
  // Columns are declared as inline literals at every call site, so they are a
  // new array each render and the sort recomputes with them. At the 500-row cap
  // these tables fetch that is well under a millisecond, and the alternative —
  // asking every caller to memoise its column list — is a footgun that fails
  // silently when someone forgets.
  const sortColumns = columns.map((c, i) => ({
    key: String(i),
    sortValue: c.sortValue,
    descFirst: c.descFirst,
  }));

  const { rows: sortedRows, sort, setSort, toggle } = useTableSort(rows, sortColumns, defaultSort);

  const mobileLabels: Record<string, string> = {};
  columns.forEach((c, i) => {
    if (!c.sortValue) return;
    mobileLabels[String(i)] = c.sortLabel ?? (typeof c.label === "string" ? c.label : String(i));
  });

  return (
    <>
      {/* Desktop / tablet */}
      <AdminCard className="hidden sm:block overflow-hidden">
        <div className={cn("overflow-x-auto", maxHeightClass && `${maxHeightClass} overflow-y-auto`)}>
          <table className="w-full text-sm">
            <thead className={cn(stickyHeader && "sticky top-0 z-10 bg-admin-surface")}>
              <tr className="text-xs text-admin-text-faint uppercase tracking-wider border-b border-admin-border">
                {columns.map((c, i) => (
                  <th
                    key={i}
                    aria-sort={c.sortValue ? ariaSort(sort, String(i)) : undefined}
                    className={cn(
                      "px-4 py-3 whitespace-nowrap",
                      c.align === "center" && "text-center",
                      c.align === "right" && "text-right",
                      (!c.align || c.align === "left") && "text-left",
                      c.className,
                    )}
                  >
                    <SortHeader
                      label={c.label}
                      columnKey={String(i)}
                      sortable={!!c.sortValue}
                      sort={sort}
                      onToggle={toggle}
                      align={c.align}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr key={rowKey(row, i)} className="border-t border-admin-border-subtle hover:bg-admin-surface-2/40">
                  {renderRow(row, i)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Mobile */}
      <div className="sm:hidden">
        <MobileSortBar columns={sortColumns} labels={mobileLabels} sort={sort} onSet={setSort} />
        <div className={cn("space-y-2", maxHeightClass && `${maxHeightClass} overflow-y-auto`)}>
          {sortedRows.map((row, i) => (
            <AdminCard key={rowKey(row, i)} className="p-3">
              {renderCard(row, i)}
            </AdminCard>
          ))}
        </div>
      </div>
    </>
  );
}

/** Label/value pair for the mobile card layout. */
export function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-admin-text-faint shrink-0">{label}</span>
      <span className="text-xs text-admin-text-secondary text-right min-w-0 break-words">{children}</span>
    </div>
  );
}
