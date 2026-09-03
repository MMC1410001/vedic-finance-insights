import { beforeEach, describe, expect, it } from "vitest";
import analytics from "@/lib/analytics";

describe("analytics: dataLayer path (named click tags)", () => {
  beforeEach(() => {
    // Force the "GTM snippet hasn't run yet" state
    delete (window as { dataLayer?: unknown }).dataLayer;
  });
  it("creates window.dataLayer when the GTM snippet hasn't run", () => {
    analytics({ "gtm.text": "VedicFinance_Logo" });
    expect(window.dataLayer).toEqual([
      { event: "gtm.click", "gtm.text": "VedicFinance_Logo" },
    ]);
  });
  it("appends to an existing dataLayer rather than replacing it", () => {
    window.dataLayer = [{ event: "gtm.js" }];
    analytics({ "gtm.text": "Header_FAQ" });
    expect(window.dataLayer).toHaveLength(2);
    expect(window.dataLayer[1]).toEqual({
      event: "gtm.click",
      "gtm.text": "Header_FAQ",
    });
  });
  it("defaults to gtm.click with an empty payload", () => {
    analytics();
    expect(window.dataLayer[0]).toEqual({ event: "gtm.click" });
  });
  // Non-click events (a confirmed purchase, a generated report) cannot use
  // Click Text triggers, so they need their own event name.
  it("honours a custom event name", () => {
    analytics({ method: "google" }, "Auth_LoginSuccess");
    expect(window.dataLayer[0]).toEqual({
      event: "Auth_LoginSuccess",
      method: "google",
    });
  });
});
