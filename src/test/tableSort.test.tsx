import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { act } from "react";

import { AdminTable } from "@/components/admin/AdminTable";
import { compareDirectional, compareValues } from "@/components/admin/table-sort";

/**
 * The sort is shared by four tables, so the rules worth pinning are the ones
 * that are easy to get subtly wrong and hard to notice: where blanks land, how
 * IPs and other digit-bearing strings order, and that a third click returns to
 * the server's order rather than sticking on descending.
 */

describe("compareValues", () => {
  const sortAsc = (xs: (string | number | null | undefined)[]) => [...xs].sort(compareValues);

  it("sorts blanks last, whichever direction you asked for", () => {
    // A missing email is absent, not "less than" an email. Letting null win
    // ascending order buries every real row under the blanks.
    expect(sortAsc(["b", null, "a", "", undefined])).toEqual(["a", "b", null, "", undefined]);

    // And descending must not float them to the top. This is the regression:
    // negating the whole ascending comparator negates the blank rule with it,
    // which is exactly what the first implementation did.
    const desc = ["b", null, "a"].sort((x, y) => compareDirectional(x, y, "desc"));
    expect(desc).toEqual(["b", "a", null]);
  });

  it("orders IP addresses numerically, not lexically", () => {
    // Plain string compare puts .63 before .9 because "6" < "9".
    expect(sortAsc(["192.168.0.63", "192.168.0.9", "10.0.0.1"])).toEqual([
      "10.0.0.1",
      "192.168.0.9",
      "192.168.0.63",
    ]);
  });

  it("orders numbers as numbers", () => {
    expect(sortAsc([10, 2, 33, 1])).toEqual([1, 2, 10, 33]);
  });

  it("orders booleans false-then-true, so descending surfaces the flag", () => {
    // The columns where this matters (Admin, has-a-kundali) are declared
    // descFirst, so one click puts the flagged rows on top.
    expect([true, false, true].sort(compareValues)).toEqual([false, true, true]);
    expect([false, true].sort((x, y) => compareDirectional(x, y, "desc"))).toEqual([true, false]);
  });

  it("ignores case so names do not split into two alphabets", () => {
    expect(sortAsc(["banana", "Apple", "cherry"])).toEqual(["Apple", "banana", "cherry"]);
  });
});

interface Row {
  id: string;
  name: string | null;
  count: number;
}

const ROWS: Row[] = [
  { id: "1", name: "Charlie", count: 5 },
  { id: "2", name: null, count: 30 },
  { id: "3", name: "alice", count: 12 },
];

function Harness() {
  return (
    <AdminTable
      rows={ROWS}
      rowKey={(r) => r.id}
      columns={[
        { label: "#" },
        { label: "Name", sortValue: (r) => r.name },
        { label: "Count", sortValue: (r) => r.count, descFirst: true },
      ]}
      renderRow={(r, i) => (
        <>
          <td>{i + 1}</td>
          <td>{r.name ?? "—"}</td>
          <td>{r.count}</td>
        </>
      )}
      renderCard={(r) => <span>{r.name ?? "—"}</span>}
    />
  );
}

/** The desktop table's row order, by the Name cell. */
const order = () =>
  [...document.querySelectorAll("tbody tr")].map((tr) => tr.children[1]?.textContent);

const clickHeader = (label: string) => {
  // Two matches — the <th> text and the sort button; the button is the one bound.
  const btn = screen.getAllByRole("button").find((b) => b.textContent?.startsWith(label));
  act(() => btn!.click());
};

describe("AdminTable sorting", () => {
  it("leaves rows in the order they were given until a header is clicked", () => {
    render(<Harness />);
    expect(order()).toEqual(["Charlie", "—", "alice"]);
  });

  it("sorts ascending on first click, with blanks last", () => {
    render(<Harness />);
    clickHeader("Name");
    expect(order()).toEqual(["alice", "Charlie", "—"]);
  });

  it("reverses on the second click and still keeps blanks last", () => {
    render(<Harness />);
    clickHeader("Name");
    clickHeader("Name");
    expect(order()).toEqual(["Charlie", "alice", "—"]);
  });

  it("returns to the original order on the third click", () => {
    // Without this there is no way back to the server's own ordering — which is
    // meaningful here, since rows arrive newest-first — short of a page reload.
    render(<Harness />);
    clickHeader("Name");
    clickHeader("Name");
    clickHeader("Name");
    expect(order()).toEqual(["Charlie", "—", "alice"]);
  });

  it("starts descending for a descFirst column", () => {
    render(<Harness />);
    clickHeader("Count");
    expect(order()).toEqual(["—", "alice", "Charlie"]); // 30, 12, 5
  });

  it("renumbers the # column to match the visible order", () => {
    render(<Harness />);
    clickHeader("Name");
    const first = document.querySelector("tbody tr");
    expect(first?.children[0]?.textContent).toBe("1");
    expect(first?.children[1]?.textContent).toBe("alice");
  });

  it("does not mutate the caller's rows array", () => {
    const before = ROWS.map((r) => r.id);
    render(<Harness />);
    clickHeader("Name");
    expect(ROWS.map((r) => r.id)).toEqual(before);
  });

  it("announces the sort state on the header cell", () => {
    render(<Harness />);
    const nameTh = [...document.querySelectorAll("th")].find((th) =>
      th.textContent?.startsWith("Name"),
    );
    expect(nameTh?.getAttribute("aria-sort")).toBe("none");
    clickHeader("Name");
    expect(nameTh?.getAttribute("aria-sort")).toBe("ascending");
    clickHeader("Name");
    expect(nameTh?.getAttribute("aria-sort")).toBe("descending");
  });

  it("leaves columns without a sortValue unclickable", () => {
    render(<Harness />);
    const numTh = [...document.querySelectorAll("th")].find((th) => th.textContent === "#");
    expect(numTh?.querySelector("button")).toBeNull();
    expect(numTh?.getAttribute("aria-sort")).toBeNull();
  });

  it("offers the same columns on the phone layout, which has no headers to click", () => {
    render(<Harness />);
    const select = screen.getByRole("combobox");
    const options = [...select.querySelectorAll("option")].map((o) => o.textContent);
    expect(options).toEqual(["Default order", "Name", "Count"]);
  });
});
