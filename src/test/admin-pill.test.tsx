import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Pill } from "@/components/admin/AdminCard";

/**
 * The pill's shape contract.
 *
 * `inline-flex` is the load-bearing class: it makes the badge an atomic inline
 * box, and line breaking cannot split one of those. The defect was a plain
 * inline span, which breaks over two lines and gets its border-radius applied at
 * each fragment's boundaries — two half pills stacked up.
 *
 * jsdom lays nothing out, so these are contract assertions only. The proof that
 * the property holds on a real page is in e2e/admin-responsive.spec.ts, which
 * reads computed display; `whitespace-nowrap` is defensive here rather than the
 * cure, and is asserted because it is part of the contract, not because a width
 * could ever falsify it.
 */
describe("Pill", () => {
  const classesOf = (ui: React.ReactElement) =>
    render(ui).container.firstElementChild!.className;

  // The one that matters: an atomic inline box cannot be split across lines, so
  // the half-pill defect becomes unreachable rather than merely unlikely.
  it("is an atomic inline box, not a plain inline span", () => {
    expect(classesOf(<Pill>Awaiting Payment</Pill>)).toContain("inline-flex");
  });

  it("is fully rounded, and asks not to wrap", () => {
    const cls = classesOf(<Pill>Awaiting Payment</Pill>);
    expect(cls).toContain("rounded-full");
    expect(cls).toContain("whitespace-nowrap");
  });

  it("carries the tone it is given", () => {
    const cls = classesOf(<Pill tone="bg-admin-warn/20 text-admin-warn">x</Pill>);
    expect(cls).toContain("bg-admin-warn/20");
    expect(cls).toContain("text-admin-warn");
  });

  it("offers the three scales already used across the panel", () => {
    expect(classesOf(<Pill size="sm">x</Pill>)).toContain("text-[10px]");
    expect(classesOf(<Pill size="md">x</Pill>)).toContain("text-xs");
    expect(classesOf(<Pill size="lg">x</Pill>)).toContain("py-1");
  });

  // twMerge, so a caller's padding beats the size's. That is what lets the
  // handful of px-1.5 chips keep their tighter look without a fourth size.
  it("lets className win over the size", () => {
    const cls = classesOf(<Pill size="sm" className="px-1.5">x</Pill>);
    expect(cls).toContain("px-1.5");
    expect(cls).not.toContain("px-2 ");
  });

  // The escape hatch. A wrapping pill must drop rounded-full, or the middle
  // lines render as lens shapes — the same defect in a different guise.
  it("swaps to a fixed radius when wrapping is allowed", () => {
    const cls = classesOf(<Pill wrap>a very long label indeed</Pill>);
    expect(cls).not.toContain("rounded-full");
    expect(cls).not.toContain("whitespace-nowrap");
    expect(cls).toContain("rounded-lg");
  });

  it("passes a title through for hover", () => {
    const { container } = render(<Pill title="why">x</Pill>);
    expect(container.firstElementChild!.getAttribute("title")).toBe("why");
  });
});
