import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: { invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })) },
  },
}));

import { supabase } from "@/lib/supabase";
import {
  isEmbedded, isHeatmapPreview, isUntrackedPath, trackingSuppressed,
} from "@/lib/tracking-scope";
import { __peekQueue, __resetQueue, queueEvent } from "@/lib/event-queue";
import { trackVisit } from "@/lib/visitor-tracking";

const invoke = vi.mocked(supabase.functions.invoke);
const originalSearch = window.location.search;

const SAME_ORIGIN = "https://vedicfinance.ai";
const HOSTILE_ORIGIN = "https://evil.example";

/** jsdom's location is not writable; replace the descriptor for the test. */
function setLocation(search: string, pathname = "/home") {
  Object.defineProperty(window, "location", {
    configurable: true,
    // `origin` explicitly: spreading jsdom's Location copies no own properties,
    // so without this the same-origin comparison would be undefined === undefined
    // and would pass for the wrong reason.
    value: { ...window.location, origin: SAME_ORIGIN, search, pathname },
  });
}

const setSearch = (search: string) => setLocation(search);

beforeEach(() => {
  sessionStorage.clear();
  invoke.mockClear();
  __resetQueue();
});

afterEach(() => setSearch(originalSearch));

describe("isEmbedded", () => {
  it("is false for a normal top-level page", () => {
    setSearch("");
    expect(isEmbedded()).toBe(false);
  });

  it("is true when the embed flag is set", () => {
    setSearch("?embed=true");
    expect(isEmbedded()).toBe(true);
  });

  it("ignores other values of the flag", () => {
    setSearch("?embed=1");
    expect(isEmbedded()).toBe(false);
    setSearch("?embed=false");
    expect(isEmbedded()).toBe(false);
  });

  it("survives an unparseable query string", () => {
    setSearch("?%%%");
    expect(() => isEmbedded()).not.toThrow();
  });
});

/**
 * The reason this guard exists, and why it is a data-integrity rule rather than
 * a preference: the /admin heatmap renders the real page in an iframe so the
 * click map has something to sit on. Without this, opening the heatmap writes
 * rows — from the office IP — into the very table the panel is reading, and
 * every number moves as a side effect of looking at it.
 */
describe("analytics inside an embed", () => {
  it("queues nothing on the batched path", () => {
    setSearch("?embed=true");
    queueEvent("page_view");
    queueEvent("click", { props: { selector: "button:Pay" } });
    expect(__peekQueue()).toHaveLength(0);
  });

  it("sends nothing on the immediate path", () => {
    setSearch("?embed=true");
    trackVisit("visit");
    trackVisit("kundali_generated");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("still records both when NOT embedded, so the guard is not simply off", () => {
    setSearch("");
    queueEvent("page_view");
    trackVisit("visit");
    expect(__peekQueue()).toHaveLength(1);
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

describe("isUntrackedPath", () => {
  // Operating the panel is us looking at the data. The click listener always
  // skipped /admin; page views, session duration and sign-ins were still being
  // recorded, so an admin session showed up as a real visitor.
  it("excludes the admin panel and anything under it", () => {
    expect(isUntrackedPath("/admin")).toBe(true);
    expect(isUntrackedPath("/admin/users")).toBe(true);
  });

  it("does not exclude a product route that merely starts similarly", () => {
    expect(isUntrackedPath("/administrator-guide")).toBe(false);
    expect(isUntrackedPath("/home")).toBe(false);
    expect(isUntrackedPath("/kundali")).toBe(false);
  });
});

describe("trackingSuppressed", () => {
  it("is true on /admin even without an embed flag", () => {
    setLocation("", "/admin");
    expect(trackingSuppressed()).toBe(true);
  });

  it("is true inside an embed even on a product route", () => {
    setLocation("?embed=true", "/home");
    expect(trackingSuppressed()).toBe(true);
  });

  it("is false for an ordinary visit", () => {
    setLocation("", "/home");
    expect(trackingSuppressed()).toBe(false);
  });
});

describe("analytics on the admin panel", () => {
  it("records nothing on either path", () => {
    setLocation("", "/admin");
    queueEvent("page_view");
    trackVisit("signed_in");
    expect(__peekQueue()).toHaveLength(0);
    expect(invoke).not.toHaveBeenCalled();
  });
});

/**
 * The three-condition rule, and why it is three.
 *
 * This flag makes /auth and /payment skip their self-redirects so the heatmap
 * shows the page it claims. /payment skipping its `hasPaid` redirect puts the ₹99
 * offer back in front of a paid user, who could start a second order — harmless
 * inside the panel's pointer-events-none iframe, a real regression in a normal
 * tab. The frame check is what separates those two cases.
 */
describe("isHeatmapPreview", () => {
  /**
   * Put the page inside a frame whose parent sits on `parentOrigin`.
   *
   * `null` models a cross-origin parent: the browser throws SecurityError on any
   * read of its location, which is the only signal a framed page gets about who
   * framed it.
   */
  function frameWith(parentOrigin: string | null) {
    const parent =
      parentOrigin === null
        ? {
            get location(): never {
              throw new DOMException("Blocked a frame", "SecurityError");
            },
          }
        : { location: { origin: parentOrigin } };
    Object.defineProperty(window, "top", { configurable: true, value: parent });
    Object.defineProperty(window, "parent", { configurable: true, value: parent });
  }

  function unframe() {
    Object.defineProperty(window, "top", { configurable: true, value: window.self });
    Object.defineProperty(window, "parent", { configurable: true, value: window.self });
  }

  const framed = (value: boolean) => (value ? frameWith(SAME_ORIGIN) : unframe());

  afterEach(() => unframe());

  it("is true only with both flags AND a same-origin parent frame", () => {
    setLocation("?embed=true&preview=heatmap", "/payment");
    frameWith(SAME_ORIGIN);
    expect(isHeatmapPreview()).toBe(true);
  });

  // The case that must never pass: someone hand-typing the URL in a normal tab.
  it("is false when the page is not framed, however it is flagged", () => {
    setLocation("?embed=true&preview=heatmap", "/payment");
    unframe();
    expect(isHeatmapPreview()).toBe(false);
  });

  /**
   * The reason this check exists at all. Being framed is something any page on
   * the internet can arrange, and both route guards render their children on
   * this answer — so a hostile origin framing /payment must not be able to skip
   * the hasPaid redirect.
   */
  it("is false when the parent frame is cross-origin and unreadable", () => {
    setLocation("?embed=true&preview=heatmap", "/payment");
    frameWith(null);
    expect(isHeatmapPreview()).toBe(false);
  });

  it("is false when the parent frame is readable but on another origin", () => {
    setLocation("?embed=true&preview=heatmap", "/kundali");
    frameWith(HOSTILE_ORIGIN);
    expect(isHeatmapPreview()).toBe(false);
  });

  it("is false when either flag is missing", () => {
    framed(true);

    setLocation("?embed=true", "/payment");
    expect(isHeatmapPreview()).toBe(false);

    setLocation("?preview=heatmap", "/payment");
    expect(isHeatmapPreview()).toBe(false);

    setLocation("", "/payment");
    expect(isHeatmapPreview()).toBe(false);
  });

  // An ordinary embed — the landing page's kundali viewer — must not get it.
  it("is false for a plain embed without the preview flag", () => {
    setLocation("?embed=true", "/kundali");
    framed(true);
    expect(isHeatmapPreview()).toBe(false);
    // But it is still suppressed for analytics, which is a separate question.
    expect(trackingSuppressed()).toBe(true);
  });
});
