/**
 * The clickable pieces of the column sort. Logic lives in ./table-sort.
 */

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortState, SortableColumn } from "./table-sort";

/**
 * A column header that sorts. Renders plain text when the column has no
 * sortValue, so callers can map over their columns without branching.
 */
export function SortHeader({
  label,
  columnKey,
  sortable,
  sort,
  onToggle,
  align = "left",
}: {
  label: React.ReactNode;
  columnKey: string;
  sortable: boolean;
  sort: SortState | null;
  onToggle: (key: string) => void;
  align?: "left" | "center" | "right";
}) {
  if (!sortable) return <>{label}</>;

  const active = sort?.key === columnKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <button
      type="button"
      onClick={() => onToggle(columnKey)}
      title={active ? `Sorted ${sort.dir === "asc" ? "ascending" : "descending"}, click to change` : "Sort by this column"}
      className={cn(
        "group inline-flex items-center gap-1 uppercase tracking-wider transition-colors",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        active ? "text-admin-info" : "hover:text-admin-text-secondary",
      )}
    >
      {label}
      <Icon
        className={cn(
          "w-3 h-3 shrink-0 transition-opacity",
          // The inactive chevron is faint rather than absent: an arrow that only
          // appears on hover leaves no hint the column is sortable at all.
          active ? "opacity-100" : "opacity-40 group-hover:opacity-80",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

/**
 * Phone equivalent of clickable headers.
 *
 * The <sm layout is one card per row with no header at all, so without this the
 * feature simply would not exist on a phone. A select plus a direction button,
 * rather than a row of pills, because these tables have eight or nine sortable
 * columns.
 */
export function MobileSortBar({
  columns,
  labels,
  sort,
  onSet,
}: {
  // Only key / descFirst / whether it is sortable are read, so this stays
  // assignable from SortableColumn<T> for any T.
  columns: { key: string; sortValue?: unknown; descFirst?: boolean }[];
  labels: Record<string, string>;
  sort: SortState | null;
  onSet: (s: SortState | null) => void;
}) {
  const sortableKeys = columns.filter((c) => c.sortValue).map((c) => c.key);
  if (sortableKeys.length === 0) return null;

  return (
    <div className="sm:hidden flex items-center gap-2 mb-2">
      {/* The visible label is not associated with the select (no htmlFor/id), so
          without aria-label a screen reader announces an unnamed combobox. It
          also gives tests a way to target the sort control specifically, rather
          than every <select> that happens to be on the page. */}
      <label className="text-[10px] uppercase tracking-wider text-admin-text-faint shrink-0">Sort</label>
      <select
        aria-label="Sort column"
        value={sort?.key ?? ""}
        onChange={(e) => {
          const key = e.target.value;
          if (!key) return onSet(null);
          const col = columns.find((c) => c.key === key);
          onSet({ key, dir: col?.descFirst ? "desc" : "asc" });
        }}
        /* 44px, unconditionally: this whole control is `sm:hidden`, so it only
           ever renders on a phone — and it is the ONLY way to sort a table
           there, the column headers being desktop-only. It was ~30px. */
        className="flex-1 min-w-0 min-h-[44px] px-2 rounded-lg bg-admin-surface border border-admin-border text-xs text-admin-text outline-none focus:border-admin-info/40"
      >
        <option value="">Default order</option>
        {sortableKeys.map((key) => (
          <option key={key} value={key}>
            {labels[key] ?? key}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!sort}
        onClick={() => sort && onSet({ key: sort.key, dir: sort.dir === "asc" ? "desc" : "asc" })}
        aria-label={sort?.dir === "asc" ? "Sort descending" : "Sort ascending"}
        className="grid place-items-center min-h-[44px] min-w-[44px] rounded-lg border border-admin-border text-admin-text-muted hover:text-admin-text hover:bg-admin-surface-2 transition-colors disabled:opacity-40 shrink-0"
      >
        {sort?.dir === "desc" ? <ArrowDown className="w-3.5 h-3.5" /> : <ArrowUp className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
