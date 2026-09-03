/**
 * Column sorting for the admin tables — comparator and state.
 *
 * Lives outside AdminTable because one table cannot use it: the Users table has
 * expandable rows (a second <tr> per user holding their kundalis), which
 * AdminTable's cells-only `renderRow` contract cannot express. So the rules are
 * written once here and both the AdminTable-driven tables and the hand-rolled
 * Users table drive them.
 *
 * Split from the header components (TableSortControls.tsx) because mixing
 * exported functions and components in one file breaks Fast Refresh.
 */

import { useCallback, useMemo, useState } from "react";

export type Sortable = string | number | boolean | null | undefined;
export type SortDir = "asc" | "desc";
export interface SortState {
  key: string;
  dir: SortDir;
}

const isBlank = (v: Sortable) => v === null || v === undefined || v === "";

/**
 * Compare two present values, ascending. Blank handling lives in
 * `compareDirectional` — see the note there for why it cannot live here.
 *
 * Strings compare numeric-aware: `localeCompare(…, { numeric: true })` is what
 * makes IPs order correctly (192.168.0.9 before 192.168.0.63, rather than after
 * it because "6" < "9"), and the same for anything else with digits in it.
 * `sensitivity: "base"` keeps "alice" and "Alice" in one alphabet instead of
 * two.
 */
export function compareValues(a: Sortable, b: Sortable): number {
  if (isBlank(a) && isBlank(b)) return 0;
  if (isBlank(a)) return 1;
  if (isBlank(b)) return -1;

  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);

  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Compare with direction applied — and blanks pinned to the bottom either way.
 *
 * This exists as its own function because the obvious implementation is wrong:
 * negating a whole ascending comparator for descending negates the blank rule
 * along with everything else, floating every empty cell to the top. A missing
 * email is absent, not "greater than" every email, so it belongs at the end of
 * both orders. Caught by test, not by reading — the first version of this
 * multiplied by the direction factor and did exactly that.
 */
export function compareDirectional(a: Sortable, b: Sortable, dir: SortDir): number {
  if (isBlank(a) && isBlank(b)) return 0;
  if (isBlank(a)) return 1;
  if (isBlank(b)) return -1;
  return compareValues(a, b) * (dir === "asc" ? 1 : -1);
}

export interface SortableColumn<T> {
  /** Stable identity for the sort state. */
  key: string;
  /** The value to order by. Omit to leave the column unsortable (e.g. "#", "Actions"). */
  sortValue?: (row: T) => Sortable;
  /**
   * Start descending on first click. Right for dates and counts — "newest" and
   * "most" are what you actually want to see, and making the operator click
   * twice for it every time is a small tax on every visit.
   */
  descFirst?: boolean;
}

/**
 * Sort state plus the sorted rows.
 *
 * Clicking a header cycles through three states, not two: first direction,
 * opposite, then off. Off matters — the server's own order is meaningful here
 * (kundalis and sessions come back newest-first) and without a way back you
 * cannot return to it short of reloading the page.
 */
export function useTableSort<T>(rows: T[], columns: SortableColumn<T>[], initial?: SortState) {
  const [sort, setSort] = useState<SortState | null>(initial ?? null);

  const byKey = useMemo(() => {
    const map = new Map<string, SortableColumn<T>>();
    for (const c of columns) map.set(c.key, c);
    return map;
  }, [columns]);

  const toggle = useCallback(
    (key: string) => {
      const col = byKey.get(key);
      if (!col?.sortValue) return;
      const firstDir: SortDir = col.descFirst ? "desc" : "asc";

      setSort((prev) => {
        if (prev?.key !== key) return { key, dir: firstDir };
        if (prev.dir === firstDir) return { key, dir: firstDir === "asc" ? "desc" : "asc" };
        return null;
      });
    },
    [byKey],
  );

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const get = byKey.get(sort.key)?.sortValue;
    if (!get) return rows;

    // Copy: sorting `rows` in place would mutate the caller's state array.
    // Array.prototype.sort is stable, so rows with equal keys keep the order the
    // server sent them in.
    return [...rows].sort((a, b) => compareDirectional(get(a), get(b), sort.dir));
  }, [rows, sort, byKey]);

  return { rows: sortedRows, sort, setSort, toggle, sortable: byKey };
}

/** `aria-sort` for a <th>, so the sort is announced rather than only drawn. */
export function ariaSort(sort: SortState | null, key: string): "ascending" | "descending" | "none" {
  if (sort?.key !== key) return "none";
  return sort.dir === "asc" ? "ascending" : "descending";
}
