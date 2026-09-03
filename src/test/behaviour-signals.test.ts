/**
 * The four admin-only behaviour signals.
 *
 * The property that matters most here is negative and is asserted first: none of
 * these may reach window.dataLayer. They exist for /admin only, and the analytics
 * team's GTM container must be unable to see them — that is the whole reason they
 * bypass analytics() and call queueEvent() directly.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  },
}));

import { __peekQueue, __resetQueue } from "@/lib/event-queue";
import {
  __resetScrollTracking,
  installScrollTracking,
  resetScrollDepth,
} from "@/lib/scroll-tracking";
import {
  __resetCtaVisibility,
  installCtaVisibility,
  resetCtaViews,
} from "@/lib/cta-visibility";

/** Set the page geometry jsdom does not compute for itself. */
function setPage({ scrollHeight, innerHeight, scrollY }: {
  scrollHeight: number;
  innerHeight: number;
  scrollY: number;
}) {
  Object.defineProperty(document.documentElement, "scrollHeight", {
    value: scrollHeight,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", { value: innerHeight, configurable: true });
  Object.defineProperty(window, "scrollY", { value: scrollY, configurable: true });
}

beforeEach(() => {
  sessionStorage.clear();
  __resetQueue();
  __resetScrollTracking();
  __resetCtaVisibility();
  document.body.innerHTML = "";
  delete (window as { dataLayer?: unknown }).dataLayer;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  __resetScrollTracking();
  __resetCtaVisibility();
  document.body.innerHTML = "";
});

describe("scroll depth", () => {
  it("records each milestone once and only those actually reached", () => {
    // Half of a 4000px page seen through an 800px viewport: 1200 + 800 = 2000.
    setPage({ scrollHeight: 4000, innerHeight: 800, scrollY: 1200 });
    installScrollTracking();
    vi.advanceTimersByTime(500);

    let depths = __peekQueue()
      .filter((e) => e.event === "scroll_depth")
      .map((e) => e.props!.depth);
    expect(depths).toEqual([25, 50]);

    // Further down, but not to the end.
    setPage({ scrollHeight: 4000, innerHeight: 800, scrollY: 2400 });
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(500);

    depths = __peekQueue()
      .filter((e) => e.event === "scroll_depth")
      .map((e) => e.props!.depth);
    // 25 and 50 are not repeated — that is what makes these countable as people.
    expect(depths).toEqual([25, 50, 75]);
  });

  it("reports a page that fits the viewport as fully seen", () => {
    // Otherwise a short page reports nothing at all, which reads identically to
    // "nobody scrolled" when in fact everybody saw all of it.
    setPage({ scrollHeight: 700, innerHeight: 800, scrollY: 0 });
    installScrollTracking();
    vi.advanceTimersByTime(500);

    const depths = __peekQueue()
      .filter((e) => e.event === "scroll_depth")
      .map((e) => e.props!.depth);
    expect(depths).toEqual([25, 50, 75, 100]);
  });

  it("does not count a fling that passes through on the way down", () => {
    setPage({ scrollHeight: 4000, innerHeight: 800, scrollY: 0 });
    installScrollTracking();
    vi.advanceTimersByTime(500);
    __resetQueue();

    // Three scroll events inside the settle window, ending at the bottom. Only
    // where the page came to REST is recorded, so this is one measurement.
    setPage({ scrollHeight: 4000, innerHeight: 800, scrollY: 800 });
    window.dispatchEvent(new Event("scroll"));
    setPage({ scrollHeight: 4000, innerHeight: 800, scrollY: 2000 });
    window.dispatchEvent(new Event("scroll"));
    setPage({ scrollHeight: 4000, innerHeight: 800, scrollY: 3200 });
    window.dispatchEvent(new Event("scroll"));
    vi.advanceTimersByTime(500);

    // Every milestone at once, from the resting position — not four separate
    // trailing-edge measurements as it passed each one.
    expect(__peekQueue().filter((e) => e.event === "scroll_depth")).toHaveLength(4);
  });

  it("starts over on the next page view", () => {
    setPage({ scrollHeight: 700, innerHeight: 800, scrollY: 0 });
    installScrollTracking();
    vi.advanceTimersByTime(500);
    const first = __peekQueue().filter((e) => e.event === "scroll_depth").length;

    // Without this the milestones would be per session rather than per page, so a
    // visitor would report 25% once and then never again however many pages they
    // read — which is not a question anyone asks.
    resetScrollDepth();
    vi.advanceTimersByTime(500);

    expect(__peekQueue().filter((e) => e.event === "scroll_depth")).toHaveLength(first * 2);
  });

  it("carries the page height the depth was a percentage of", () => {
    setPage({ scrollHeight: 5555, innerHeight: 800, scrollY: 5000 });
    installScrollTracking();
    vi.advanceTimersByTime(500);

    // "50%" is not comparable between a 3,000px page and a 9,000px one, so the
    // panel needs to know which it was. Same reason click_points carries doc_h.
    expect(__peekQueue()[0].props).toMatchObject({ doc_h: 5555 });
  });

  it("never touches dataLayer", () => {
    setPage({ scrollHeight: 700, innerHeight: 800, scrollY: 0 });
    installScrollTracking();
    vi.advanceTimersByTime(500);

    expect(__peekQueue().length).toBeGreaterThan(0);
    expect(window.dataLayer).toBeUndefined();
  });
});

describe("CTA impressions", () => {
  /**
   * A controllable IntersectionObserver.
   *
   * jsdom has none, and the real one would never fire anyway: nothing in jsdom
   * has a layout. This records the observed elements and lets a test say "this
   * one is now half visible".
   */
  function stubObserver() {
    const observed = new Set<Element>();
    let callback: IntersectionObserverCallback = () => {};

    class Stub {
      constructor(cb: IntersectionObserverCallback) {
        callback = cb;
      }
      observe(el: Element) {
        observed.add(el);
      }
      unobserve(el: Element) {
        observed.delete(el);
      }
      disconnect() {
        observed.clear();
      }
      takeRecords() {
        return [];
      }
    }

    vi.stubGlobal("IntersectionObserver", Stub as unknown as typeof IntersectionObserver);

    return {
      observed,
      /** Report an element as `ratio` visible. */
      show(el: Element, ratio = 1) {
        callback(
          [{ target: el, isIntersecting: ratio > 0, intersectionRatio: ratio } as
            unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      },
      hide(el: Element) {
        callback(
          [{ target: el, isIntersecting: false, intersectionRatio: 0 } as
            unknown as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      },
    };
  }

  it("counts a CTA held on screen for a full second", () => {
    document.body.innerHTML = `<button data-af-tag="UnlockKndali_Pay99">Pay</button>`;
    const io = stubObserver();
    installCtaVisibility();

    const cta = document.querySelector("button")!;
    expect(io.observed.has(cta)).toBe(true);

    io.show(cta);
    vi.advanceTimersByTime(1100);

    const views = __peekQueue().filter((e) => e.event === "cta_view");
    expect(views).toHaveLength(1);
    expect(views[0].props).toMatchObject({ tag: "UnlockKndali_Pay99" });
  });

  it("does not count a CTA scrolled past in under a second", () => {
    // The whole reason for the dwell. Counting first intersection would credit an
    // impression to every CTA a fling passes, inflating the denominator and making
    // every CTA look worse than it is — failing in the direction that misleads.
    document.body.innerHTML = `<button data-af-tag="Header_FAQ">FAQ</button>`;
    const io = stubObserver();
    installCtaVisibility();

    const cta = document.querySelector("button")!;
    io.show(cta);
    vi.advanceTimersByTime(400);
    io.hide(cta);
    vi.advanceTimersByTime(2000);

    expect(__peekQueue().filter((e) => e.event === "cta_view")).toHaveLength(0);
  });

  it("does not count a CTA only slightly on screen", () => {
    document.body.innerHTML = `<button data-af-tag="Footer_FAQ">FAQ</button>`;
    const io = stubObserver();
    installCtaVisibility();

    io.show(document.querySelector("button")!, 0.2);
    vi.advanceTimersByTime(2000);

    expect(__peekQueue().filter((e) => e.event === "cta_view")).toHaveLength(0);
  });

  it("counts one impression per tag per page view", () => {
    document.body.innerHTML = `<button data-af-tag="VedicFinance_Logo">Logo</button>`;
    const io = stubObserver();
    installCtaVisibility();
    const cta = document.querySelector("button")!;

    // Scrolled past, back to, and past again is one impression — and this is also
    // what stops a sticky header CTA emitting on every scroll reversal.
    for (let i = 0; i < 4; i++) {
      io.show(cta);
      vi.advanceTimersByTime(1100);
      io.hide(cta);
    }

    expect(__peekQueue().filter((e) => e.event === "cta_view")).toHaveLength(1);
  });

  it("allows the same tag one impression again on the next page", () => {
    document.body.innerHTML = `<button data-af-tag="VedicFinance_Logo">Logo</button>`;
    const io = stubObserver();
    installCtaVisibility();
    const cta = document.querySelector("button")!;

    io.show(cta);
    vi.advanceTimersByTime(1100);

    // A CTA present on three pages must be creditable on each of them, or its
    // impression count is really "pages on which it was first seen".
    resetCtaViews();
    io.show(cta);
    vi.advanceTimersByTime(1100);

    expect(__peekQueue().filter((e) => e.event === "cta_view")).toHaveLength(2);
  });

  it("picks up a CTA that arrives with a lazily loaded chunk", () => {
    // Almost every route in this app is React.lazy behind <Suspense fallback={null}>,
    // so at install time the page is genuinely empty. A one-off querySelectorAll
    // would find nothing on every route in the app.
    const io = stubObserver();
    installCtaVisibility();
    expect(io.observed.size).toBe(0);

    const late = document.createElement("button");
    late.setAttribute("data-af-tag", "VedicFinance_Unlockyourkundali_1");
    document.body.append(late);
    // MutationObserver callbacks are microtasks; jsdom delivers them on the
    // microtask queue, which fake timers do not drive.
    return Promise.resolve().then(() => {
      expect(io.observed.has(late)).toBe(true);
    });
  });

  it("never touches dataLayer", () => {
    document.body.innerHTML = `<button data-af-tag="Header_Insights">Insights</button>`;
    const io = stubObserver();
    installCtaVisibility();

    io.show(document.querySelector("button")!);
    vi.advanceTimersByTime(1100);

    expect(__peekQueue().length).toBeGreaterThan(0);
    expect(window.dataLayer).toBeUndefined();
  });
});
