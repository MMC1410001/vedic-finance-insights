import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
  },
}));

import { supabase } from "@/lib/supabase";
import {
  __resetAttribution,
  captureAttribution,
  currentAttribution,
  ensureVisitorId,
  firstTouchAttribution,
  stampFirstTouchOnce,
} from "@/lib/utm";

const rpc = vi.mocked(supabase.rpc);

/** jsdom has no navigation, but replaceState moves window.location just fine. */
function goTo(url: string): void {
  window.history.replaceState(null, "", url);
}

function land(url: string) {
  goTo(url);
  __resetAttribution();
  captureAttribution();
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  rpc.mockClear();
  __resetAttribution();
  goTo("/home");
});

describe("captureAttribution — parsing", () => {
  it("reads the five UTMs and stores both touches", () => {
    land(
      "/home?utm_source=whatsapp&utm_medium=message&utm_campaign=2026-09-diwali" +
        "&utm_content=broadcast-1&utm_term=kundali",
    );

    const touch = currentAttribution();
    expect(touch).toMatchObject({
      utm_source: "whatsapp",
      utm_medium: "message",
      utm_campaign: "2026-09-diwali",
      utm_content: "broadcast-1",
      utm_term: "kundali",
      landing_path: "/home",
    });
    expect(firstTouchAttribution()?.utm_campaign).toBe("2026-09-diwali");
    expect(localStorage.getItem("afVisitorId")).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("collapses a /shared/<slug> landing so no share token is stored", () => {
    land("/shared/abc123xyz?utm_source=whatsapp");
    expect(currentAttribution()?.landing_path).toBe("/shared/:slug");
  });

  it("keeps a click id's case and prefers gclid over fbclid", () => {
    land("/home?gclid=Cj0KCQiA_Xy&fbclid=IwAR9zz");
    expect(currentAttribution()).toMatchObject({
      click_id: "Cj0KCQiA_Xy",
      click_id_source: "gclid",
    });
  });

  it("treats a click id alone as tagged traffic", () => {
    land("/home?fbclid=IwAR9zz");
    expect(currentAttribution()?.click_id_source).toBe("fbclid");
  });
});

describe("normalisation", () => {
  const cases: [string, string | null][] = [
    ["WHATSAPP", "whatsapp"],
    ["  Instagram  ", "instagram"],
    // URLSearchParams decodes `+` to a space; both must land on one row.
    ["Diwali Sale", "diwali-sale"],
    ["Community+message", "community-message"],
    ["Diwali Sale!!", "diwali-sale"],
    ["--x--", "x"],
    ["a__b", "a__b"],
    // PII, dropped whole rather than scrubbed into a plausible campaign name.
    ["ravi@gmail.com", null],
    ["ravi%40gmail.com", null],
    ["broadcast-9876543210", null],
    // Rejected, not truncated: a clipped name is a different campaign.
    ["x".repeat(65), null],
    ["!!!", null],
  ];

  it.each(cases)("normalises %s", (input, expected) => {
    land(`/home?utm_campaign=${encodeURIComponent(input)}`);
    expect(currentAttribution()?.utm_campaign ?? null).toBe(expected);
  });

  it("keeps a 64-character value, the boundary case", () => {
    const exact = "c".repeat(64);
    land(`/home?utm_campaign=${exact}`);
    expect(currentAttribution()?.utm_campaign).toBe(exact);
  });

  it("keeps the other fields when one is rejected", () => {
    land("/home?utm_source=whatsapp&utm_term=ravi@gmail.com");
    expect(currentAttribution()).toMatchObject({ utm_source: "whatsapp", utm_term: null });
  });
});

describe("first touch", () => {
  it("is never overwritten by a later tagged visit", () => {
    land("/home?utm_campaign=first-one");
    land("/home?utm_campaign=second-one");

    expect(firstTouchAttribution()?.utm_campaign).toBe("first-one");
    expect(currentAttribution()?.utm_campaign).toBe("second-one");
  });

  it("is not written by an untagged first visit", () => {
    land("/home");
    expect(firstTouchAttribution()).toBeNull();
  });

  // Stamping `direct` on a direct first visit would permanently mark the person
  // as organic and make every campaign they later arrive from look barren.
  it("is claimed by a tagged visit that follows an untagged one", () => {
    land("/home");
    land("/home?utm_campaign=late-claim");
    expect(firstTouchAttribution()?.utm_campaign).toBe("late-claim");
  });

  it("is replaced once older than the 90-day window", () => {
    land("/home?utm_campaign=ancient");
    const stored = JSON.parse(localStorage.getItem("afFirstTouch")!);
    stored.first_touch_at = new Date(Date.now() - 91 * 24 * 3600_000).toISOString();
    localStorage.setItem("afFirstTouch", JSON.stringify(stored));

    land("/home?utm_campaign=fresh");
    expect(firstTouchAttribution()?.utm_campaign).toBe("fresh");
  });

  it("keeps its claim at 30 days", () => {
    land("/home?utm_campaign=ancient");
    const stored = JSON.parse(localStorage.getItem("afFirstTouch")!);
    stored.first_touch_at = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
    localStorage.setItem("afFirstTouch", JSON.stringify(stored));

    land("/home?utm_campaign=fresh");
    expect(firstTouchAttribution()?.utm_campaign).toBe("ancient");
  });

  it("keeps its claim when the stored timestamp is corrupt", () => {
    land("/home?utm_campaign=ancient");
    const stored = JSON.parse(localStorage.getItem("afFirstTouch")!);
    stored.first_touch_at = "not-a-date";
    localStorage.setItem("afFirstTouch", JSON.stringify(stored));

    land("/home?utm_campaign=fresh");
    expect(firstTouchAttribution()?.utm_campaign).toBe("ancient");
  });

  // Regression: the TTL was checked only when deciding whether a NEW tagged
  // visit could replace the stored claim, so an expired one never lapsed on its
  // own. The shared-laptop case the TTL exists for is exactly the one where no
  // replacement ever arrives — a colleague opens the site untagged, and an
  // untagged visit writes nothing by design.
  it("lapses on read once expired, with no replacing visit", () => {
    land("/home?utm_campaign=ancient");
    const stored = JSON.parse(localStorage.getItem("afFirstTouch")!);
    stored.first_touch_at = new Date(Date.now() - 91 * 24 * 3600_000).toISOString();
    localStorage.setItem("afFirstTouch", JSON.stringify(stored));

    land("/home");
    expect(firstTouchAttribution()).toBeNull();
  });

  it("still reads back at 89 days", () => {
    land("/home?utm_campaign=ancient");
    const stored = JSON.parse(localStorage.getItem("afFirstTouch")!);
    stored.first_touch_at = new Date(Date.now() - 89 * 24 * 3600_000).toISOString();
    localStorage.setItem("afFirstTouch", JSON.stringify(stored));

    land("/home");
    expect(firstTouchAttribution()?.utm_campaign).toBe("ancient");
  });
});

describe("normalisation the server will also accept", () => {
  // Regression: the client stripped leading `-` and `.` but not `_`, while
  // event-payload.ts requires the first character to be [a-z0-9]. `_promo`
  // therefore reached GTM intact and was dropped by track-visit — present in
  // GA4, missing from /admin, no error on either side.
  it("strips a leading underscore, which the server rejects", () => {
    land("/home?utm_campaign=_promo");
    expect(firstTouchAttribution()?.utm_campaign).toBe("promo");
  });

  it("strips trailing underscores too", () => {
    land("/home?utm_campaign=promo__");
    expect(firstTouchAttribution()?.utm_campaign).toBe("promo");
  });

  it("keeps underscores inside a value, which the server allows", () => {
    land("/home?utm_campaign=diwali_2026");
    expect(firstTouchAttribution()?.utm_campaign).toBe("diwali_2026");
  });
});

describe("an untagged visit", () => {
  // This is what survives the OAuth round trip: Google returns to a bare /auth,
  // and that arrival must not wipe the campaign the session started with.
  it("does not clear the session's last touch", () => {
    land("/home?utm_campaign=still-here");
    land("/auth");
    expect(currentAttribution()?.utm_campaign).toBe("still-here");
  });

  it("does not rewrite the URL", () => {
    land("/auth?intent=payment");
    expect(window.location.search).toBe("?intent=payment");
  });
});

describe("URL cleaning", () => {
  it("strips only our params and keeps the rest", () => {
    land("/auth?intent=payment&utm_source=instagram&utm_campaign=x&gclid=abc&ref=friend");
    const params = new URLSearchParams(window.location.search);
    expect(params.get("intent")).toBe("payment");
    expect(params.get("ref")).toBe("friend");
    expect(params.get("utm_source")).toBeNull();
    expect(params.get("gclid")).toBeNull();
  });

  it("leaves no dangling ? when nothing else remains", () => {
    land("/home?utm_source=whatsapp");
    expect(window.location.search).toBe("");
    expect(window.location.pathname).toBe("/home");
  });

  it("preserves the hash", () => {
    land("/home?utm_source=whatsapp#pricing");
    expect(window.location.hash).toBe("#pricing");
  });
});

describe("guards", () => {
  it("records nothing and rewrites nothing inside an embed", () => {
    // trackingSuppressed(): the /admin heatmap frames real pages, so capturing
    // there would both record us and rewrite the framed page's URL.
    land("/home?embed=true&utm_source=whatsapp");
    expect(currentAttribution()).toBeNull();
    expect(new URLSearchParams(window.location.search).get("utm_source")).toBe("whatsapp");
  });

  it("records nothing on /admin", () => {
    land("/admin?utm_source=whatsapp");
    expect(currentAttribution()).toBeNull();
  });

  it("captures once per page load", () => {
    goTo("/home?utm_campaign=one");
    __resetAttribution();
    captureAttribution();
    goTo("/home?utm_campaign=two");
    captureAttribution(); // latched — no reset in between
    expect(currentAttribution()?.utm_campaign).toBe("one");
  });
});

describe("hostile storage", () => {
  it("still attributes the page load when writes throw", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("private mode");
      });

    expect(() => land("/home?utm_source=whatsapp&utm_campaign=private")).not.toThrow();
    expect(currentAttribution()).toMatchObject({
      utm_source: "whatsapp",
      utm_campaign: "private",
    });

    setItem.mockRestore();
  });

  it("survives a corrupt stored value", () => {
    sessionStorage.setItem("afLastTouch", "{not json");
    expect(currentAttribution()).toBeNull();
  });

  it("returns a stable visitor id", () => {
    const first = ensureVisitorId();
    expect(ensureVisitorId()).toBe(first);
  });
});

describe("stampFirstTouchOnce", () => {
  it("does nothing without a first touch", async () => {
    land("/home");
    await stampFirstTouchOnce();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sends the stored first touch and latches on a write", async () => {
    land("/home?utm_source=whatsapp&utm_campaign=2026-09-diwali");
    await stampFirstTouchOnce();

    expect(rpc).toHaveBeenCalledWith(
      "stamp_first_touch",
      expect.objectContaining({ p_source: "whatsapp", p_campaign: "2026-09-diwali" }),
    );

    await stampFirstTouchOnce();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  // A brand-new signup has no user_profiles row yet, so the UPDATE matches
  // nothing. That call must not latch, or the post-upsert call never runs.
  it("does not latch when the update matched no row", async () => {
    land("/home?utm_source=whatsapp");
    rpc.mockResolvedValueOnce({ data: null, error: null } as never);

    await stampFirstTouchOnce();
    await stampFirstTouchOnce();
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("swallows an RPC failure", async () => {
    land("/home?utm_source=whatsapp");
    rpc.mockRejectedValueOnce(new Error("offline"));
    await expect(stampFirstTouchOnce()).resolves.toBeUndefined();
  });

  // Google Ads and Meta auto-tagging append a click id and no utm_source at all.
  // The session half of the Campaigns table calls those google/cpc and
  // facebook/cpc (click_network() in 019); if the user half stamped them
  // `(none)`, one campaign's sessions and its revenue would land on two
  // different rows of the same table.
  it("names the ad network when a click id arrived without a utm_source", async () => {
    land("/home?gclid=Cj0KCQiA-abc_123");
    await stampFirstTouchOnce();

    expect(rpc).toHaveBeenCalledWith(
      "stamp_first_touch",
      expect.objectContaining({ p_source: "google", p_medium: "cpc" }),
    );
  });

  it("names Meta the same way", async () => {
    land("/home?fbclid=IwAR0abcDEF");
    await stampFirstTouchOnce();

    expect(rpc).toHaveBeenCalledWith(
      "stamp_first_touch",
      expect.objectContaining({ p_source: "facebook", p_medium: "cpc" }),
    );
  });

  // An explicit tag is the advertiser's own answer and always wins.
  it("never lets the click id override a declared utm_source", async () => {
    land("/home?utm_source=whatsapp&utm_medium=message&gclid=Cj0KCQiA-abc_123");
    await stampFirstTouchOnce();

    expect(rpc).toHaveBeenCalledWith(
      "stamp_first_touch",
      expect.objectContaining({ p_source: "whatsapp", p_medium: "message" }),
    );
  });
});
