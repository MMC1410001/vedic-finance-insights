import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COORD_PATHS,
  normalisePath,
  pageLabel,
  samplesCoordinates,
  TRACKED_PAGES,
} from "@/lib/tracked-pages";

/**
 * Routes declared in App.tsx that are deliberately absent from the catalogue.
 *
 *   /admin — trackingSuppressed() refuses to record it at all
 *   /app   — a <Navigate>, not a page
 *   *      — the 404 route
 */
const NOT_PAGES = new Set(["/admin", "/app", "*"]);

/** Dynamic routes, listed in the catalogue in their normalised form. */
const DYNAMIC = new Map([["/shared/:slug", "/shared/:slug"]]);

function routesFromApp(): string[] {
  const source = readFileSync("src/App.tsx", "utf8");
  return [...source.matchAll(/path="([^"]+)"/g)].map((m) => m[1]);
}

describe("TRACKED_PAGES", () => {
  it("has no duplicate paths", () => {
    const paths = TRACKED_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("gives every page a label that is not just its path", () => {
    for (const page of TRACKED_PAGES) {
      expect(page.label.length, page.path).toBeGreaterThan(0);
      expect(page.label, page.path).not.toBe(page.path);
    }
  });

  /**
   * The guard that matters. Coordinates are only sampled on catalogue paths, so a
   * route added without one is a page that can never produce a heatmap — and the
   * old failure mode was exactly that, silently, with nothing on screen to
   * explain why /profile and /ai-chat were missing from the picker.
   */
  it("covers every real route declared in App.tsx", () => {
    const declared = routesFromApp().filter((p) => !NOT_PAGES.has(p));
    const known = new Set(TRACKED_PAGES.map((p) => p.path));

    const missing = declared.filter((route) => {
      const normalised = route.includes(":") ? DYNAMIC.get(route) ?? route : route;
      return !known.has(normalised);
    });

    expect(
      missing,
      `these routes exist in App.tsx but not in TRACKED_PAGES, so they can never be sampled: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("does not list routes that are not pages", () => {
    const known = new Set(TRACKED_PAGES.map((p) => p.path));
    for (const path of NOT_PAGES) {
      expect(known.has(path), path).toBe(false);
    }
  });

  it("derives COORD_PATHS from itself, so sampling and the picker cannot drift", () => {
    expect([...COORD_PATHS]).toEqual(TRACKED_PAGES.map((p) => p.path));
  });
});

describe("pageLabel", () => {
  it("names the two sign-in surfaces distinguishably", () => {
    // They are indistinguishable from their paths alone in a dropdown, which is
    // the whole reason labels exist.
    expect(pageLabel("/auth")).not.toBe(pageLabel("/kundali-auth"));
    expect(pageLabel("/auth")).toMatch(/sign in/i);
    expect(pageLabel("/kundali-auth")).toMatch(/kundali/i);
  });

  it("falls back to the path for anything unknown", () => {
    expect(pageLabel("/not-a-route")).toBe("/not-a-route");
  });
});

describe("normalisePath", () => {
  /**
   * Every shared kundali is a different URL and the same page. Stored raw, the
   * pages table gets one row per share and the heatmap picker one entry per
   * share — and a heatmap of one visitor's link is a heatmap of nothing. This
   * cannot be undone after the rows are written, which is why it happens at
   * record time.
   */
  it("collapses shared-kundali links to one page", () => {
    expect(normalisePath("/shared/abc123")).toBe("/shared/:slug");
    expect(normalisePath("/shared/xyz789")).toBe("/shared/:slug");
    expect(normalisePath("/shared/abc123")).toBe(normalisePath("/shared/def456"));
  });

  it("leaves static paths alone", () => {
    for (const path of ["/", "/home", "/kundali", "/ai-chat"]) {
      expect(normalisePath(path)).toBe(path);
    }
  });

  it("treats a trailing slash as the same page", () => {
    expect(normalisePath("/home/")).toBe("/home");
    // The root is one character and must survive.
    expect(normalisePath("/")).toBe("/");
  });

  it("does not collapse a deeper path that merely starts the same", () => {
    expect(normalisePath("/shared")).toBe("/shared");
    expect(normalisePath("/shared/abc/extra")).toBe("/shared/abc/extra");
  });

  it("survives an empty path", () => {
    expect(normalisePath("")).toBe("/");
  });
});

describe("samplesCoordinates", () => {
  it("accepts a raw dynamic path by normalising it first", () => {
    expect(samplesCoordinates("/shared/abc123")).toBe(true);
  });

  it("rejects the admin panel and unknown paths", () => {
    expect(samplesCoordinates("/admin")).toBe(false);
    expect(samplesCoordinates("/nope")).toBe(false);
  });
});
