import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  },
}));

import analytics from "@/lib/analytics";
import {
  __resetClickTracking,
  describeElement,
  installClickTracking,
  normalisePoint,
  resetPageInteractions,
} from "@/lib/click-tracking";
// Moved to the shared catalogue: sampling, the heatmap picker and the dev mock
// all derive from one list now.
import { samplesCoordinates } from "@/lib/tracked-pages";
import { __peekQueue, __resetQueue } from "@/lib/event-queue";

beforeEach(() => {
  sessionStorage.clear();
  __resetQueue();
  __resetClickTracking();
  document.body.innerHTML = "";
  installClickTracking();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("describeElement", () => {
  it("prefers an explicit data-af-tag over anything derived", () => {
    const el = document.createElement("button");
    el.setAttribute("data-af-tag", "Hero_Primary");
    el.textContent = "Unlock your Financial Kundali";
    expect(describeElement(el).selector).toBe("Hero_Primary");
  });

  it("uses the accessible name ahead of the visible text", () => {
    const el = document.createElement("button");
    el.setAttribute("aria-label", "Open the full sample report");
    el.textContent = "Tap to read full report";
    expect(describeElement(el).selector).toBe("button:Open the full sample report");
  });

  it("collapses whitespace so one button is one label", () => {
    const el = document.createElement("a");
    el.textContent = "  Privacy\n   Policy  ";
    expect(describeElement(el).selector).toBe("a:Privacy Policy");
  });

  it("falls back to the id, then to the bare tag", () => {
    const withId = document.createElement("input");
    withId.id = "birth-date";
    expect(describeElement(withId).selector).toBe("input:#birth-date");

    expect(describeElement(document.createElement("select")).selector).toBe("select");
  });

  // Two buttons with identical text are indistinguishable by label alone — the
  // hero has exactly this problem (see ANALYTICS.md on the mobile CTA), and
  // data-af-tag is the escape hatch.
  it("gives identical-text buttons the same label, which is why data-af-tag exists", () => {
    const a = document.createElement("button");
    const b = document.createElement("button");
    a.textContent = "Unlock your Financial Kundali for ₹99 FREE";
    b.textContent = "Unlock your Financial Kundali for ₹99 FREE";
    expect(describeElement(a).selector).toBe(describeElement(b).selector);
  });
});

describe("normalisePoint", () => {
  it("scales against the document, not the viewport", () => {
    expect(normalisePoint(360, 1200, 1440, 4800)).toEqual({ x_pct: 0.25, y_pct: 0.25 });
  });

  it("clamps out-of-range and non-finite values instead of writing a bad row", () => {
    expect(normalisePoint(-40, 99_999, 1440, 4800)).toEqual({ x_pct: 0, y_pct: 1 });
    expect(normalisePoint(Number.NaN, 0, 1440, 4800)).toEqual({ x_pct: 0, y_pct: 0 });
  });

  it("survives a zero-sized document rather than dividing by zero", () => {
    expect(normalisePoint(10, 10, 0, 0)).toEqual({ x_pct: 1, y_pct: 1 });
  });
});

describe("samplesCoordinates", () => {
  it("collects coordinates on every tracked page", () => {
    for (const path of ["/home", "/payment", "/auth", "/kundali", "/profile", "/ai-chat"]) {
      expect(samplesCoordinates(path), path).toBe(true);
    }
  });

  // It used to be five hand-picked paths, which meant /profile and /ai-chat could
  // never produce a heatmap however long the panel ran — and nothing said why.
  it("no longer excludes the pages an operator asked for", () => {
    expect(samplesCoordinates("/profile")).toBe(true);
    expect(samplesCoordinates("/ai-chat")).toBe(true);
  });

  it("excludes the admin panel and anything unrecognised", () => {
    expect(samplesCoordinates("/admin")).toBe(false);
    expect(samplesCoordinates("/not-a-route")).toBe(false);
  });

  it("recognises a shared kundali through its normalised form", () => {
    expect(samplesCoordinates("/shared/abc123")).toBe(true);
  });
});

describe("the delegated listener", () => {
  it("records a click on an interactive element", () => {
    const button = document.createElement("button");
    button.textContent = "Continue";
    document.body.append(button);

    button.click();

    expect(__peekQueue()).toHaveLength(1);
    expect(__peekQueue()[0].event).toBe("click");
    expect(__peekQueue()[0].props).toMatchObject({ selector: "button:Continue" });
  });

  it("attributes a click on a child to the interactive ancestor", () => {
    document.body.innerHTML = `<a href="#x"><span>Read more</span></a>`;
    document.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(__peekQueue()).toHaveLength(1);
    expect(__peekQueue()[0].props).toMatchObject({ selector: "a:Read more" });
  });

  it("ignores clicks on plain text, so the table is not full of body copy", () => {
    // Math.random pinned above DEAD_SAMPLE_RATE so the dead-click sample cannot
    // fire here. Without it this test flakes roughly one run in seven: a
    // non-interactive click is no longer *nothing*, it is a dead_click candidate.
    const random = vi.spyOn(Math, "random").mockReturnValue(0.99);

    document.body.innerHTML = `<p>Some paragraph of marketing copy</p>`;
    document.querySelector("p")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // The point of the rule: no `click` row. That is the table this protects.
    expect(__peekQueue().filter((e) => e.event === "click")).toHaveLength(0);
    expect(__peekQueue()).toHaveLength(0);

    random.mockRestore();
  });

  // This is the reason the listener is in the capture phase. A bubble-phase
  // listener never runs when a handler stops propagation, and several do.
  it("still sees a click whose handler calls stopPropagation", () => {
    const button = document.createElement("button");
    button.textContent = "Guarded";
    button.addEventListener("click", (e) => e.stopPropagation());
    document.body.append(button);

    button.click();

    expect(__peekQueue()).toHaveLength(1);
  });

  it("does not count our own clicks inside /admin", () => {
    const original = window.location.pathname;
    // jsdom allows a pushState-driven path change, which is enough here.
    window.history.pushState({}, "", "/admin");

    const button = document.createElement("button");
    button.textContent = "Refresh";
    document.body.append(button);
    button.click();

    expect(__peekQueue()).toHaveLength(0);
    window.history.pushState({}, "", original);
  });

  it("is idempotent, so a remount does not double-count", () => {
    installClickTracking();
    installClickTracking();

    const button = document.createElement("button");
    button.textContent = "Once";
    document.body.append(button);
    button.click();

    expect(__peekQueue()).toHaveLength(1);
  });
});

// The mechanism the whole design rests on: the listener records in the capture
// phase, analytics() names the row afterwards from inside the click handler.
describe("capture-then-enrich, end to end", () => {
  it("produces one row carrying both the derived selector and the GTM tag", () => {
    const button = document.createElement("button");
    button.textContent = "Pay ₹99";
    button.addEventListener("click", () => {
      analytics({ "gtm.text": "UnlockKndali_Pay99" });
    });
    document.body.append(button);

    button.click();

    // One row, not two. A bubble-phase listener plus a separate analytics()
    // write would produce two and double every named tag's count.
    expect(__peekQueue()).toHaveLength(1);
    expect(__peekQueue()[0].props).toMatchObject({
      selector: "button:Pay ₹99",
      tag: "UnlockKndali_Pay99",
    });
  });

  it("still pushes to dataLayer, so the GTM contract is untouched", () => {
    delete (window as { dataLayer?: unknown }).dataLayer;

    const button = document.createElement("button");
    button.textContent = "FAQ";
    button.addEventListener("click", () => analytics({ "gtm.text": "Header_FAQ" }));
    document.body.append(button);

    button.click();

    expect(window.dataLayer).toEqual([{ event: "gtm.click", "gtm.text": "Header_FAQ" }]);
  });

  it("queues a row of its own when analytics() is called outside a real click", () => {
    analytics({ "gtm.text": "Purchase_Confirmed_Standin" });

    expect(__peekQueue()).toHaveLength(1);
    expect(__peekQueue()[0].props).toMatchObject({
      tag: "Purchase_Confirmed_Standin",
      synthetic: true,
    });
  });

  it("leaves the first-party log alone for non-click event names", () => {
    // Filing a purchase or a login success under a "click" verb would put a lie
    // in the events table; those need their own verb when they land.
    analytics({ method: "google" }, "Auth_LoginSuccess");
    expect(__peekQueue()).toHaveLength(0);
  });
});

// ── Dead clicks ─────────────────────────────────────────────────────────────
// These exist because an empty region of the heatmap used to be ambiguous:
// "nobody clicked here" and "people click here constantly and nothing happens"
// drew exactly the same picture, and only one of them is a fault.
describe("dead clicks", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records a click that hit nothing interactive, with a position", () => {
    // Under both sample gates: the coordinate gate and the dead gate.
    vi.spyOn(Math, "random").mockReturnValue(0);

    document.body.innerHTML = `<section id="hero"><p>Marketing copy</p></section>`;
    document.querySelector("p")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const queue = __peekQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].event).toBe("dead_click");
    // A dead click with no position has no name and no location — there would be
    // nothing to learn from it, so it is never recorded without one.
    expect(queue[0].point).toBeDefined();
    expect(queue[0].point!.doc_h).toBeGreaterThan(0);
  });

  it("names the nearest identifiable element, so the row says what was clicked", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    document.body.innerHTML = `<div id="hero-copy"><span>Read this</span></div>`;
    document.querySelector("span")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // Named through describeElement, exactly like a real click — so the same
    // region carries the same label in the friction table as it would in the
    // clicks table. That means the visible text wins over the id, which is why
    // this reads "div:Read this" rather than "div:#hero-copy".
    expect(__peekQueue()[0].props).toMatchObject({ selector: "div:Read this" });
  });

  it("never records one for a click that DID hit a control", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const button = document.createElement("button");
    button.textContent = "Continue";
    document.body.append(button);
    button.click();

    expect(__peekQueue().filter((e) => e.event === "dead_click")).toHaveLength(0);
    expect(__peekQueue().filter((e) => e.event === "click")).toHaveLength(1);
  });

  it("caps them per page view, so one restless visitor cannot fill a batch", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    document.body.innerHTML = `<section id="hero"><p>Copy</p></section>`;
    const p = document.querySelector("p")!;

    // Well past the cap. Each click is dispatched at a fresh position so the rage
    // detector does not add rows of its own and confuse the count.
    for (let i = 0; i < 30; i++) {
      p.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: i * 100 }));
    }

    const dead = __peekQueue().filter((e) => e.event === "dead_click");
    expect(dead.length).toBeGreaterThan(0);
    expect(dead.length).toBeLessThanOrEqual(8);
  });

  it("starts a fresh allowance on the next page view", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    document.body.innerHTML = `<section id="hero"><p>Copy</p></section>`;
    const p = document.querySelector("p")!;

    for (let i = 0; i < 30; i++) {
      p.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: i * 100 }));
    }
    const first = __peekQueue().filter((e) => e.event === "dead_click").length;

    // What RouteTracker calls on every route change. Without it the cap would be
    // per session, so a visitor who exhausted it on the landing page would be
    // silently unmeasured for the rest of their visit.
    resetPageInteractions();
    p.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 7 }));

    expect(__peekQueue().filter((e) => e.event === "dead_click").length).toBe(first + 1);
  });
});

// ── Rage clicks ─────────────────────────────────────────────────────────────
describe("rage clicks", () => {
  afterEach(() => vi.restoreAllMocks());

  /** jsdom does not compute pageX from clientX, so set it explicitly. */
  function clickAt(el: Element, x: number, y: number) {
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "pageX", { value: x });
    Object.defineProperty(event, "pageY", { value: y });
    el.dispatchEvent(event);
  }

  it("fires once on the third click in one spot, not on every click after", () => {
    const button = document.createElement("button");
    button.textContent = "Stuck";
    document.body.append(button);

    clickAt(button, 100, 100);
    clickAt(button, 102, 101);
    clickAt(button, 101, 103);
    // A fourth and fifth are part of the same gesture, not two more bursts.
    clickAt(button, 100, 100);
    clickAt(button, 100, 100);

    expect(__peekQueue().filter((e) => e.event === "rage_click")).toHaveLength(1);
  });

  it("ignores three clicks in different places", () => {
    const button = document.createElement("button");
    button.textContent = "Fine";
    document.body.append(button);

    clickAt(button, 0, 0);
    clickAt(button, 400, 700);
    clickAt(button, 900, 200);

    expect(__peekQueue().filter((e) => e.event === "rage_click")).toHaveLength(0);
  });

  /**
   * The rule that keeps every named tag from doubling.
   *
   * enrichLastEvent() names the TAIL of the queue and refuses anything that is not
   * a `click`. If a rage_click were queued after the click row, analytics() would
   * fail to enrich and write a second, synthetic row instead.
   */
  it("queues the click row LAST, so analytics() can still name it", () => {
    const button = document.createElement("button");
    button.textContent = "Pay ₹99";
    button.addEventListener("click", () => analytics({ "gtm.text": "UnlockKndali_Pay99" }));
    document.body.append(button);

    clickAt(button, 50, 50);
    clickAt(button, 51, 50);
    clickAt(button, 50, 51);

    const queue = __peekQueue();
    const rage = queue.findIndex((e) => e.event === "rage_click");
    expect(rage).toBeGreaterThanOrEqual(0);
    expect(queue[queue.length - 1].event).toBe("click");
    // Named, not doubled: exactly three click rows for three clicks.
    expect(queue.filter((e) => e.event === "click")).toHaveLength(3);
    expect(queue[queue.length - 1].props).toMatchObject({
      tag: "UnlockKndali_Pay99",
      selector: "button:Pay ₹99",
    });
  });
});

// ── The coordinate model ────────────────────────────────────────────────────
describe("recorded coordinates", () => {
  afterEach(() => vi.restoreAllMocks());

  it("carries the document height the fraction was taken against", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    // The admin heatmap cannot place a fraction without knowing its divisor; its
    // only other option is the height of its own iframe, which is a different
    // page state and displaced every blob.
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 4321,
      configurable: true,
    });

    const button = document.createElement("button");
    button.textContent = "Deep";
    document.body.append(button);
    button.click();

    expect(__peekQueue()[0].point).toMatchObject({ doc_h: 4321 });
  });
});
