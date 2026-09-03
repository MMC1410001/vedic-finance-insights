/**
 * Tests for the "Your Income Growth" node interaction.
 *
 * The reported bug was that hovering a data point barely worked: the handlers
 * sat on the node <g>, whose outer ring is `fill="none"`, so only the drawn
 * pixels were hoverable and the annulus between dot and ring fired a
 * leave/enter pair on every crossing. The detail panel was also rendered in
 * normal flow, so opening it resized the card. These lock in the fix:
 *   - a full-height transparent band per node owns the pointer events
 *   - the tooltip is portalled to <body>, so the card never changes height
 *   - arrow keys and Escape drive the same single active index
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import IncomeGrowthTimeline from "../components/financial-kundali/IncomeGrowthTimeline";
import { KundaliThemeProvider } from "../lib/kundali-theme-context";
import type { ReportScores, DashaInfo } from "../lib/vedicfinance-types";

const SCORES: ReportScores = {
  natal_wealth_score: 72,
  income_score: 68,
  savings_score: 55,
  investment_score: 61,
  risk_score: 40,
  expense_score: 50,
  timing_score: 65,
};

const DASHA: DashaInfo = {
  mahadasha: "Moon",
  mahadasha_lord: "Moon",
  mahadasha_start: "2020-01-01",
  mahadasha_end: "2030-01-01",
  antardasha: "Venus",
  antardasha_lord: "Venus",
  antardasha_start: "2025-01-01",
  antardasha_end: "2027-01-01",
  next_mahadasha: "Mars",
  next_mahadasha_start: "2030-01-01",
} as DashaInfo;

function renderChart() {
  return render(
    <MemoryRouter>
      <KundaliThemeProvider>
        <IncomeGrowthTimeline scores={SCORES} dasha={DASHA} transits={null} birthYear={1998} />
      </KundaliThemeProvider>
    </MemoryRouter>,
  );
}

/** The transparent full-height hit columns, one per node. */
function hitBands(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll<SVGRectElement>(".ig-hit-layer rect"));
}

/** The chart itself — `container.querySelector("svg")` would find a lucide icon. */
function chartSvg(container: HTMLElement): SVGSVGElement {
  return container.querySelector<SVGSVGElement>(".ig-chart-body svg")!;
}

function hitLayer(container: HTMLElement): SVGGElement {
  return container.querySelector<SVGGElement>(".ig-hit-layer")!;
}

function tooltip(): HTMLElement | null {
  return document.querySelector('[role="tooltip"]');
}

/* React derives onPointerEnter/onPointerLeave from pointerover/pointerout, so
   the tests must dispatch those. jsdom has no PointerEvent either, so the
   polyfill below is what carries `pointerType` through — without it every
   event looks like a touch and the mouse paths never run. */
function mouseOver(el: Element) {
  fireEvent.pointerOver(el, { pointerType: "mouse", bubbles: true });
}

function mouseOut(el: Element) {
  fireEvent.pointerOut(el, { pointerType: "mouse", bubbles: true, relatedTarget: document.body });
}

class FakePointerEvent extends MouseEvent {
  pointerType: string;
  constructor(type: string, props: PointerEventInit = {}) {
    super(type, props);
    this.pointerType = props.pointerType ?? "mouse";
  }
}

beforeEach(() => {
  vi.stubGlobal("PointerEvent", FakePointerEvent);
  (window as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;

  // jsdom returns an all-zero rect, which the anchor guard treats as "not laid
  // out yet" and skips the tooltip. Give the SVG a real box.
  Object.defineProperty(SVGElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0, y: 200, top: 200, left: 0, bottom: 480, right: 680,
      width: 680, height: 280, toJSON: () => ({}),
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IncomeGrowthTimeline node interaction", () => {
  it("gives every node a transparent full-height hit band", () => {
    const { container } = renderChart();
    const bands = hitBands(container);

    expect(bands).toHaveLength(9);
    for (const band of bands) {
      // `fill="none"` would not be hoverable — that was the original defect.
      expect(band.getAttribute("fill")).toBe("transparent");
      expect(Number(band.getAttribute("height"))).toBeGreaterThan(200);
      expect(Number(band.getAttribute("width"))).toBeGreaterThan(0);
    }
  });

  it("opens the tooltip on pointer enter and closes it on leave", () => {
    const { container } = renderChart();
    const bands = hitBands(container);

    expect(tooltip()).toBeNull();

    mouseOver(bands[0]);
    expect(tooltip()).not.toBeNull();
    expect(tooltip()!.textContent).toMatch(/mahadasha/);

    mouseOut(hitLayer(container));
    expect(tooltip()).toBeNull();
  });

  it("renders the tooltip outside the card so the card cannot change height", () => {
    const { container } = renderChart();
    const card = container.querySelector(".income-growth-card")!;

    mouseOver(hitBands(container)[1]);

    const tip = tooltip()!;
    expect(tip).not.toBeNull();
    expect(card.contains(tip)).toBe(false);
    expect(document.body.contains(tip)).toBe(true);
  });

  it("swaps content between adjacent bands without an empty frame", () => {
    const { container } = renderChart();
    const bands = hitBands(container);

    mouseOver(bands[0]);
    const first = tooltip()!.textContent;

    // No pointerleave in between — moving across the shared edge goes straight
    // from one band to the next.
    mouseOver(bands[1]);
    expect(tooltip()).not.toBeNull();
    expect(tooltip()!.textContent).not.toBe(first);
  });

  it("ignores pointer enter from touch so a scroll gesture cannot open it", () => {
    const { container } = renderChart();

    fireEvent.pointerOver(hitBands(container)[0], { pointerType: "touch", bubbles: true });
    expect(tooltip()).toBeNull();
  });

  it("toggles a pinned tooltip on tap", () => {
    const { container } = renderChart();
    const band = hitBands(container)[2];

    fireEvent.pointerDown(band, { pointerType: "touch" });
    fireEvent.click(band);
    expect(tooltip()).not.toBeNull();

    fireEvent.pointerDown(band, { pointerType: "touch" });
    fireEvent.click(band);
    expect(tooltip()).toBeNull();
  });

  it("walks nodes with the arrow keys and clears on Escape", () => {
    const { container } = renderChart();
    const svg = chartSvg(container);

    fireEvent.keyDown(svg, { key: "ArrowRight" });
    const first = tooltip()!.textContent;
    expect(first).toMatch(/mahadasha/);

    fireEvent.keyDown(svg, { key: "ArrowRight" });
    const second = tooltip()!.textContent;
    expect(second).not.toBe(first);

    fireEvent.keyDown(svg, { key: "ArrowLeft" });
    expect(tooltip()!.textContent).toBe(first);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(tooltip()).toBeNull();
  });

  it("announces the active node to screen readers", () => {
    const { container } = renderChart();
    const live = container.querySelector('[aria-live="polite"]')!;

    expect(live.textContent).toBe("");

    mouseOver(hitBands(container)[0]);
    expect(live.textContent).toContain(String(new Date().getFullYear()));
    expect(live.textContent).toMatch(/mahadasha/);
    expect(live.textContent).toMatch(/\d\.\dx/);
  });

  it("closes when the chart or page scrolls, so the tooltip never detaches", () => {
    const { container } = renderChart();

    mouseOver(hitBands(container)[0]);
    expect(tooltip()).not.toBeNull();

    fireEvent.scroll(window);
    expect(tooltip()).toBeNull();
  });

  it("exposes the chart as a single keyboard stop", () => {
    const { container } = renderChart();
    const svg = chartSvg(container);

    expect(svg.getAttribute("tabindex")).toBe("0");
    expect(svg.getAttribute("role")).toBe("group");
    expect(screen.getByRole("group")).toBe(svg);
  });
});
