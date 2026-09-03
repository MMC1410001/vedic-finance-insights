import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted above the imports, so the spy is created in the factory and pulled
// back out with vi.mocked afterwards — same shape as visitor-tracking.test.ts.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import {
  __peekQueue,
  __resetQueue,
  endAnalyticsSession,
  enrichLastEvent,
  flushEvents,
  installFlushHooks,
  queueEvent,
  sessionDurationMs,
} from "@/lib/event-queue";

const invoke = vi.mocked(supabase.functions.invoke);

interface Batch {
  session_id: string;
  events: { event: string; path: string; seq?: number; props?: Record<string, unknown> }[];
}

const lastBatch = (): Batch =>
  (invoke.mock.calls[invoke.mock.calls.length - 1][1] as { body: Batch }).body;

beforeEach(() => {
  sessionStorage.clear();
  invoke.mockClear();
  __resetQueue();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("queueEvent", () => {
  it("holds events instead of sending one request each", () => {
    queueEvent("page_view");
    queueEvent("click");
    queueEvent("click");

    // The whole point of the queue: three events, zero requests so far.
    expect(invoke).not.toHaveBeenCalled();
    expect(__peekQueue()).toHaveLength(3);
  });

  it("stamps the current path and viewport on every event", () => {
    queueEvent("click");
    const [event] = __peekQueue();
    expect(event.path).toBe(window.location.pathname);
    expect(event.viewport_w).toBe(window.innerWidth);
    expect(event.viewport_h).toBe(window.innerHeight);
  });

  it("flushes on the timer without being asked", async () => {
    queueEvent("page_view");
    expect(invoke).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(lastBatch().events).toHaveLength(1);
  });

  it("flushes immediately once a batch is full, without waiting for the timer", () => {
    for (let i = 0; i < 20; i++) queueEvent("click");
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(lastBatch().events).toHaveLength(20);
  });

  it("sends the session id the rest of the schema joins on", async () => {
    queueEvent("page_view");
    await flushEvents();
    expect(lastBatch().session_id).toBe(sessionStorage.getItem("sessionId"));
  });

  /**
   * created_at is transaction time and a batch is one insert, so every row in a
   * batch shares a timestamp. seq is the only thing admin_analytics() can order
   * a batch by — without it the dwell and exit-page windows tie-break arbitrarily
   * and per-page time in /admin is attributed to the wrong pages.
   */
  it("stamps a strictly increasing seq on every event", () => {
    queueEvent("page_view");
    queueEvent("click");
    queueEvent("page_view");

    expect(__peekQueue().map((e) => e.seq)).toEqual([0, 1, 2]);
  });

  it("keeps seq increasing across a flush boundary, not restarting per batch", async () => {
    // Fills and auto-flushes at 20, then two more.
    for (let i = 0; i < 22; i++) queueEvent("click");

    const firstBatch = (invoke.mock.calls[0][1] as { body: Batch }).body;
    expect(firstBatch.events.map((e) => e.seq)).toEqual(
      Array.from({ length: 20 }, (_, i) => i),
    );
    // The tail continues the sequence rather than starting over at 0 — two
    // batches restarting would tie all over again once they land in one table.
    expect(__peekQueue().map((e) => e.seq)).toEqual([20, 21]);
  });

  it("does not let a caller override seq", () => {
    queueEvent("click", { seq: 999 } as never);
    expect(__peekQueue()[0].seq).toBe(0);
  });

  it("keeps the queue bounded so a runaway loop cannot grow it forever", () => {
    for (let i = 0; i < 260; i++) queueEvent("error", { props: { i } });
    // Batches drain as they fill, and whatever is left is capped.
    expect(__peekQueue().length).toBeLessThanOrEqual(200);
  });
});

describe("flushEvents", () => {
  it("does nothing when there is nothing queued", async () => {
    await flushEvents();
    expect(invoke).not.toHaveBeenCalled();
  });

  // A retry queue that survives a failing endpoint turns one broken deploy into
  // a request loop, so a failed batch is dropped on purpose.
  it("drops a failed batch rather than retrying it forever", async () => {
    invoke.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    queueEvent("page_view");

    await expect(flushEvents()).resolves.toBeUndefined();
    expect(__peekQueue()).toHaveLength(0);
  });

  it("keeps draining when more than one batch is queued", async () => {
    for (let i = 0; i < 25; i++) queueEvent("click");
    // 20 went out when the batch filled; 5 remain.
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(__peekQueue()).toHaveLength(5);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(lastBatch().events).toHaveLength(5);
  });

  it("prefers sendBeacon on the exit path, because a normal request is cancelled", async () => {
    const sendBeacon = vi.fn(() => true);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });

    queueEvent("session_end", { duration_ms: 4_000 });
    await flushEvents(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    // And it must NOT also go through invoke, or the row is written twice.
    expect(invoke).not.toHaveBeenCalled();

    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toContain("/functions/v1/track-visit");
    // text/plain is CORS-safelisted, so the beacon needs no preflight it has no
    // time to complete. Changing this to application/json breaks the exit flush
    // silently. (Blob lowercases the type per spec, hence the case-insensitive
    // match rather than the literal string passed in.)
    expect(blob.type).toMatch(/^text\/plain/i);
  });
});

describe("enrichLastEvent", () => {
  it("names the click that is still in the queue", () => {
    queueEvent("click", { props: { selector: "button:Pay" } });

    expect(enrichLastEvent("click", { tag: "UnlockKndali_Pay99" })).toBe(true);

    const [event] = __peekQueue();
    // One row, carrying both the derived selector and the authoritative tag.
    expect(event.props).toEqual({ selector: "button:Pay", tag: "UnlockKndali_Pay99" });
    expect(__peekQueue()).toHaveLength(1);
  });

  it("refuses to rewrite an event of a different type", () => {
    queueEvent("page_view");
    expect(enrichLastEvent("click", { tag: "Header_FAQ" })).toBe(false);
    expect(__peekQueue()[0].props).toBeUndefined();
  });

  it("reports failure on an empty queue so the caller can queue its own row", () => {
    expect(enrichLastEvent("click", { tag: "Header_FAQ" })).toBe(false);
  });
});

describe("sessionDurationMs", () => {
  it("measures from the first event of the session, not from each call", () => {
    queueEvent("visit");
    vi.advanceTimersByTime(5_000);
    // Allow a millisecond of slack rather than asserting an exact clock value.
    expect(sessionDurationMs()).toBeGreaterThanOrEqual(5_000);
    expect(sessionDurationMs()).toBeLessThan(6_000);
  });

  it("survives a route change, because the start is in sessionStorage", () => {
    queueEvent("visit");
    const started = sessionStorage.getItem("afSessionStart");
    vi.advanceTimersByTime(1_000);
    queueEvent("page_view");
    expect(sessionStorage.getItem("afSessionStart")).toBe(started);
  });
});

describe("endAnalyticsSession", () => {
  it("clears the start time, so the next user does not inherit this one's", () => {
    queueEvent("visit");
    expect(sessionStorage.getItem("afSessionStart")).not.toBeNull();

    // Two hours of user A.
    vi.advanceTimersByTime(2 * 60 * 60 * 1000);
    endAnalyticsSession();
    expect(sessionStorage.getItem("afSessionStart")).toBeNull();

    // Sign-out hard-redirects, so user B arrives on a freshly loaded module.
    // __resetQueue() is what models that reload — without it the suppression
    // that stops the sign-out phantom row would (correctly) swallow B's events
    // too, and this test would be asserting on a session that never started.
    __resetQueue();

    // User B, three minutes.
    queueEvent("visit");
    // Asserted before the clock advance, which would flush it: B's row genuinely
    // got queued, rather than the duration assertion below passing because
    // sessionDurationMs() restarts the clock on its own.
    expect(__peekQueue()).toHaveLength(1);

    vi.advanceTimersByTime(3 * 60 * 1000);
    expect(sessionDurationMs()).toBeLessThan(4 * 60 * 1000);
  });

  /**
   * Sign-out clears sessionId and afSessionStart and then hard-redirects, and the
   * redirect fires pagehide. Anything queued in that gap measures ~0 ms and mints
   * a fresh session id to sit under — a phantom zero-view session, counted as a
   * bounce, on every single sign-out.
   */
  it("records nothing at all between sign-out and the navigation", async () => {
    queueEvent("visit");
    endAnalyticsSession();

    queueEvent("session_end", { duration_ms: 0 });
    queueEvent("click", { props: { tag: "Header_FAQ" } });

    expect(__peekQueue()).toHaveLength(0);
    await flushEvents();
    expect(invoke).not.toHaveBeenCalled();
    // And no fresh session id was minted to file a phantom row under.
    expect(sessionStorage.getItem("sessionId")).toBeNull();
  });

  it("drops the departing user's queued events rather than refiling them", () => {
    queueEvent("click", { props: { tag: "Header_FAQ" } });
    expect(__peekQueue()).toHaveLength(1);

    endAnalyticsSession();

    expect(__peekQueue()).toHaveLength(0);
    // The pending flush timer went with it, so nothing sends after sign-out.
    vi.advanceTimersByTime(60_000);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe("the page-exit beacon", () => {
  // queueEvent() flushes synchronously the moment the queue reaches MAX_BATCH,
  // so in practice it never holds more than one batch and the loop below runs
  // once. The loop is still what makes the exit path correct rather than
  // coincidentally correct: MAX_QUEUED is 200, and anything that raises the cap,
  // batches differently, or queues without going through queueEvent would
  // otherwise lose everything past the first 20 — silently, on exit, with no
  // second chance to send.
  it("empties the queue and sends it as a beacon, not a cancellable fetch", async () => {
    const sendBeacon = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });

    for (let i = 0; i < 5; i++) queueEvent("click", { props: { i } });
    invoke.mockClear();

    await flushEvents(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(__peekQueue()).toHaveLength(0);
    // A normal invoke would be cancelled by the navigation.
    expect(invoke).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("stops when the browser refuses a beacon, rather than spinning", async () => {
    // sendBeacon returns false at the browser's queue limit. The remainder
    // cannot be sent either, so looping on a refusal would spin until the page
    // is gone.
    const sendBeacon = vi.fn(() => false);
    vi.stubGlobal("navigator", { ...navigator, sendBeacon });

    for (let i = 0; i < 5; i++) queueEvent("click", { props: { i } });
    await flushEvents(true);

    expect(sendBeacon).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});

describe("installFlushHooks", () => {
  const originalLocation = window.location;

  const setPath = (pathname: string) =>
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, search: "", pathname },
    });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  /**
   * RouteTracker installs these once, from a mount effect with no deps, so a
   * bail-out is never retried. Installing only when the FIRST page happened to be
   * trackable meant a tab that started on /admin recorded page views and clicks
   * for the rest of its life but never a session_end, and dropped the queued tail
   * on exit. Suppression belongs at fire time.
   */
  it("still registers the exit listeners when the first page is suppressed", async () => {
    setPath("/admin");
    const addEventListener = vi.spyOn(window, "addEventListener");

    installFlushHooks();

    expect(addEventListener).toHaveBeenCalledWith("pagehide", expect.any(Function));
    addEventListener.mockRestore();
  });

  it("stays silent while the page is suppressed, and reports once it is not", async () => {
    setPath("/admin");
    const handlers: Record<string, () => void> = {};
    vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, fn: EventListenerOrEventListenerObject) => {
        handlers[type] = fn as () => void;
      },
    );
    // finalise() queues and flushes in one go, so the queue is already empty by
    // the time control returns — assert on what was sent, not on what is pending.
    // Without sendBeacon the exit flush falls through to invoke, whose body is a
    // plain object; jsdom's Blob cannot be read back under fake timers.
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });

    installFlushHooks();

    // Leaving /admin must not write a session_end for our own panel.
    handlers.pagehide?.();
    expect(invoke).not.toHaveBeenCalled();

    // The same listener, on a real page, does its job.
    setPath("/home");
    handlers.pagehide?.();
    await vi.advanceTimersByTimeAsync(0);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(lastBatch().events.some((e) => e.event === "session_end")).toBe(true);

    vi.restoreAllMocks();
  });
});
