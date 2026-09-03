import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * jsdom implements none of these. All are no-op stubs on purpose: the behaviour
 * that depends on them (the /admin scroll-spy, smooth jumps, recharts'
 * ResponsiveContainer, the heatmap canvas resize) is covered by unit tests on the
 * pure helpers and by real-browser checks — simulating layout in jsdom would only
 * test the simulation.
 *
 * ResizeObserver matters more than it looks: without it, any test that mounts a
 * recharts <ResponsiveContainer> throws during a passive effect and takes the
 * whole page render down with it, so the failure surfaces as "cannot find the
 * Users table" several assertions away from the cause.
 */
class NoopIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

class NoopResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Assigned through a widened alias: an `if ("IntersectionObserver" in window)`
// guard narrows `window` to `never` on the assignment line, since the type says
// the property is always there.
const globals = globalThis as unknown as Record<string, unknown>;
if (!globals.IntersectionObserver) {
  globals.IntersectionObserver = NoopIntersectionObserver;
}
if (!globals.ResizeObserver) {
  globals.ResizeObserver = NoopResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
