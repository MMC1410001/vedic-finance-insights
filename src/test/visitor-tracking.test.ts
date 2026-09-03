import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted above the imports, so the spy has to be created inside the
// factory and pulled back out via vi.mocked afterwards.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { ok: true }, error: null })),
    },
  },
}));

import { supabase } from "@/lib/supabase";
import { ensureSessionId, trackVisit } from "@/lib/visitor-tracking";
import { __resetAttribution, captureAttribution } from "@/lib/utm";

const invoke = vi.mocked(supabase.functions.invoke);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("ensureSessionId", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockClear();
  });

  it("mints a UUID and persists it under the sessionId key", () => {
    const id = ensureSessionId();
    expect(id).toMatch(UUID_RE);
    // The key name is a contract: kundli_reports.session_id, the SIGNED_OUT wipe
    // list in auth-context, and visitor_events all depend on this exact string.
    expect(sessionStorage.getItem("sessionId")).toBe(id);
  });

  it("returns the same id on repeat calls", () => {
    const first = ensureSessionId();
    expect(ensureSessionId()).toBe(first);
    expect(ensureSessionId()).toBe(first);
  });

  // This is what the three call sites it replaced relied on: the id must survive
  // so getUserKundalis() can claim a guest's orphaned rows at signup.
  it("adopts an id already in sessionStorage rather than replacing it", () => {
    sessionStorage.setItem("sessionId", "11111111-2222-3333-4444-555555555555");
    expect(ensureSessionId()).toBe("11111111-2222-3333-4444-555555555555");
  });
});

describe("trackVisit", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockClear();
  });

  it("posts the session id, event and path to the track-visit function", () => {
    trackVisit("kundali_generated");

    expect(invoke).toHaveBeenCalledTimes(1);
    const [name, options] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(name).toBe("track-visit");
    expect(options.body.event).toBe("kundali_generated");
    expect(options.body.session_id).toBe(sessionStorage.getItem("sessionId"));
    expect(options.body.path).toBe(window.location.pathname);
  });

  it("defaults to the visit event", () => {
    trackVisit();
    const [, options] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(options.body.event).toBe("visit");
  });

  it("never sends an IP: the edge function reads it from request headers", () => {
    trackVisit();
    const [, options] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(Object.keys(options.body)).not.toContain("ip");
    expect(Object.keys(options.body)).not.toContain("ip_address");
  });

  // Tracking sits on the render path of App, saveKundaliReport and
  // createPaymentOrder. A throw here would break all three.
  it("swallows a rejected invoke", async () => {
    invoke.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    expect(() => trackVisit()).not.toThrow();
    await Promise.resolve();
  });

  it("swallows a synchronous throw from invoke", () => {
    invoke.mockImplementationOnce(() => {
      throw new Error("boom");
    });
    expect(() => trackVisit()).not.toThrow();
  });
});

describe("trackVisit — campaign attribution", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    invoke.mockClear();
    __resetAttribution();
    window.history.replaceState(null, "", "/home");
  });

  const body = () =>
    (invoke.mock.calls[0] as [string, { body: Record<string, unknown> }])[1].body;

  it("carries the session's campaign on the visit row", () => {
    window.history.replaceState(null, "", "/home?utm_source=whatsapp&utm_campaign=diwali");
    captureAttribution();

    trackVisit("visit");
    expect(body().attribution).toMatchObject({
      utm_source: "whatsapp",
      utm_campaign: "diwali",
    });
  });

  // Attribution describes the session, not the event. Repeating it on later
  // milestones would let a second row disagree with the landing one.
  it("sends no attribution on any other event", () => {
    window.history.replaceState(null, "", "/home?utm_source=whatsapp");
    captureAttribution();

    trackVisit("signed_in");
    expect(body().attribution).toBeUndefined();
  });

  // The regression this replaces: visitor_id lived inside the campaign block, so
  // an untagged arrival sent no attribution at all and the row landed with no
  // visitor_id. admin_audience()'s new-vs-returning split keys on that column, so
  // it could only ever describe people who arrived from a marketing link — while
  // the panel called the gap a pre-019 backlog that would fill in on its own.
  it("still sends the visitor id on an untagged visit, with no campaign fields", () => {
    captureAttribution();

    trackVisit("visit");
    const sent = body();
    const attribution = sent.attribution as Record<string, unknown>;

    expect(attribution.visitor_id).toBe(localStorage.getItem("afVisitorId"));
    expect(attribution.visitor_id).toEqual(expect.any(String));
    // Browser identity travels; a campaign nobody arrived from does not.
    expect(attribution.utm_source).toBeUndefined();
    expect(attribution.utm_campaign).toBeUndefined();

    expect(sent.event).toBe("visit");
    expect(sent.session_id).toBe(sessionStorage.getItem("sessionId"));
  });

  it("carries the same visitor id as the tagged case, not a second one", () => {
    window.history.replaceState(null, "", "/home?utm_source=whatsapp");
    captureAttribution();

    trackVisit("visit");
    const attribution = body().attribution as Record<string, unknown>;
    expect(attribution.visitor_id).toBe(localStorage.getItem("afVisitorId"));
  });

  // Still true, and still the point of separating the two: the id belongs to the
  // browser, the campaign to the session, and neither belongs on a later event.
  it("sends no attribution block at all on a non-visit event", () => {
    captureAttribution();
    trackVisit("kundali_generated");
    expect(body().attribution).toBeUndefined();
  });
});
