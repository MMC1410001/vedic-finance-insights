import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIsMobile, useMediaQuery } from "@/hooks/use-mobile";

/**
 * Replace the global matchMedia stub from setup.ts (which always answers false)
 * with one that answers `matches` and records its listeners.
 */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mql = {
    matches,
    media: "",
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    dispatchEvent: () => true,
  };
  const matchMedia = vi.fn(() => mql);
  Object.defineProperty(window, "matchMedia", { value: matchMedia, configurable: true });
  return {
    matchMedia,
    /** Simulate a viewport change, the way a real MediaQueryList would. */
    change(next: boolean) {
      // act(), so React flushes the resulting state update before we assert.
      act(() => {
        mql.matches = next;
        listeners.forEach((fn) => fn());
      });
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("useMediaQuery", () => {
  /**
   * The regression this guards. Starting at false meant every consumer rendered
   * its desktop branch for one frame and then swapped — on the landing hero the
   * horoscope wheel painted at 900x900 and jumped to 500x500 on a phone, where
   * the CSS-class version it replaced had no flash at all.
   *
   * `result.current` after renderHook is the value from the FIRST render, before
   * any effect has run, which is exactly the frame that was wrong.
   */
  it("reports the real answer on the very first render, not false", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(true);
  });

  it("still reports false when the query genuinely does not match", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(min-width: 1024px)"));
    expect(result.current).toBe(false);
  });

  it("keeps following the query after the first render", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);

    media.change(true);
    expect(result.current).toBe(true);
  });

  it("falls back to false where matchMedia does not exist", () => {
    Object.defineProperty(window, "matchMedia", { value: undefined, configurable: true });
    const { result } = renderHook(() => useMediaQuery("(max-width: 767px)"));
    expect(result.current).toBe(false);
  });
});

describe("useIsMobile", () => {
  it("asks for the breakpoint the layout is built around", () => {
    const { matchMedia } = stubMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());

    expect(matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
    expect(result.current).toBe(true);
  });
});
