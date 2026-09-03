import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const CAMPAIGNS = {
  generated_at: "2026-09-01T00:00:00.000Z",
  campaigns: [
    {
      source: "whatsapp", medium: "message", campaign: "2026-09-diwali", content: "broadcast-1",
      sessions: 100, kundali_generated: 40, signed_in: 20, payment_started: 8,
      signed_up_users: 20, paid_users: 5, revenue: 495,
    },
    // Same campaign, second creative. These must stay two rows: collapsing them
    // gives back a row that says only that the campaign ran.
    {
      source: "whatsapp", medium: "message", campaign: "2026-09-diwali", content: "broadcast-2",
      sessions: 80, kundali_generated: 12, signed_in: 4, payment_started: 1,
      signed_up_users: 4, paid_users: 0, revenue: 0,
    },
    // Revenue but no sessions in range — the row the FULL OUTER JOIN exists for.
    {
      source: "instagram", medium: "story", campaign: "2026-07-launch", content: "story-3",
      sessions: 0, kundali_generated: 0, signed_in: 0, payment_started: 0,
      signed_up_users: 0, paid_users: 3, revenue: 297,
    },
    // Neither of these is a campaign and both must stay out of the funnel.
    {
      source: "direct", medium: "(none)", campaign: "(none)", content: "(none)",
      sessions: 900, kundali_generated: 300, signed_in: 100, payment_started: 30,
      signed_up_users: 0, paid_users: 0, revenue: 0,
    },
    {
      source: "(pre-attribution)", medium: "(pre-attribution)",
      campaign: "(pre-attribution)", content: "(pre-attribution)",
      sessions: 0, kundali_generated: 0, signed_in: 0, payment_started: 0,
      signed_up_users: 0, paid_users: 11, revenue: 1089,
    },
  ],
  sources: [{ source: "whatsapp", sessions: 100, revenue: 495 }],
  totals: { tagged_sessions: 180, untagged_sessions: 900, unattributed_paid_users: 11 },
};

vi.mock("@/lib/admin-api", () => ({
  invokeAdmin: vi.fn(() => Promise.resolve({ campaigns: CAMPAIGNS })),
}));

import { CampaignsPanel } from "@/components/admin/CampaignsPanel";

const renderPanel = async () => {
  const view = render(<CampaignsPanel from="2026-08-01" to="2026-09-01" excludeInternal />);
  await waitFor(() => expect(screen.getByText("Campaign funnel")).toBeInTheDocument());
  return view;
};

/**
 * The funnel's fill widths, in order, as numbers of percent.
 *
 * Scoped to the funnel's own card: the Sources breakdown below it also draws
 * inline-width bars, so a container-wide query silently picks those up too.
 */
const funnelWidths = () => {
  const card = screen.getByText("Campaign funnel").closest(".rounded-xl");
  if (!card) throw new Error("funnel card not found");
  return Array.from(card.querySelectorAll<HTMLElement>("[style*='width']")).map((el) =>
    Number.parseFloat(el.style.width),
  );
};

describe("CampaignsPanel funnel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("defaults to all tagged traffic, leaving direct and pre-attribution out", async () => {
    const { container } = await renderPanel();

    // Only the two real campaigns are summed: 100 + 0 sessions, 5 + 3 paid.
    // Including direct would put 900 sessions at the top of a campaign funnel.
    expect(screen.getByRole("combobox", { name: "Campaign funnel" })).toHaveValue("__all_tagged");
    expect(container.textContent).toContain("All tagged traffic · 180 sessions");
    expect(container.textContent).toContain("₹792 from 8 paying users");
    // Both belong in the table and neither belongs in the funnel picker, so
    // assert on the options rather than on the panel's whole text.
    const options = Array.from(
      container.querySelectorAll<HTMLOptionElement>("option"),
    ).map((o) => o.value);
    expect(options.some((v) => v.startsWith("direct|"))).toBe(false);
    expect(options.some((v) => v.startsWith("(pre-attribution)|"))).toBe(false);
    expect(container.textContent).toContain("(pre-attribution) / (pre-attribution)");
  });

  it("measures the user-level stages against accounts, not sessions", async () => {
    const { container } = await renderPanel();
    // sessions 180 → kundali 52 → signin 24 → paystart 9, then the group break:
    // accounts 24 is its own 100%, and paid 8 is 33.3% of it.
    expect(funnelWidths()).toEqual([100, 28.9, 13.3, 5, 100, 33.3]);
  });

  it("switches to one campaign and matches that row", async () => {
    const { container } = await renderPanel();
    fireEvent.change(screen.getByRole("combobox", { name: "Campaign funnel" }), {
      target: { value: "whatsapp|message|2026-09-diwali|broadcast-1" },
    });
    expect(funnelWidths()).toEqual([100, 40, 20, 8, 100, 25]);
    expect(container.textContent).toContain("₹495 from 5 paying users");
  });

  it("explains an empty top half rather than letting it read as broken", async () => {
    const { container } = await renderPanel();
    fireEvent.change(screen.getByRole("combobox", { name: "Campaign funnel" }), {
      target: { value: "instagram|story|2026-07-launch|story-3" },
    });
    expect(container.textContent).toContain("No sessions for this campaign inside the selected range");
    expect(container.textContent).toContain("₹297 from 3 paying users");
  });

  it("keeps two creatives of one campaign apart", async () => {
    const { container } = await renderPanel();
    const options = Array.from(
      container.querySelectorAll<HTMLOptionElement>("option"),
    ).map((o) => o.value);

    // The whole point of grouping by utm_content: one campaign, two rows.
    expect(options).toContain("whatsapp|message|2026-09-diwali|broadcast-1");
    expect(options).toContain("whatsapp|message|2026-09-diwali|broadcast-2");

    // And they report different outcomes — broadcast-2 reached 80 sessions and
    // earned nothing, which is invisible if the two are summed.
    fireEvent.change(screen.getByRole("combobox", { name: "Campaign funnel" }), {
      target: { value: "whatsapp|message|2026-09-diwali|broadcast-2" },
    });
    expect(container.textContent).toContain("₹0 from 0 paying users");
    expect(funnelWidths()).toEqual([100, 15, 5, 2, 100, 2]);
  });

  it("still shows the funnel before any campaign has run", async () => {
    // The defect this guards: the section used to be gated on having tagged
    // rows, so it vanished entirely on every panel before the first campaign —
    // which is exactly when someone goes looking for it.
    const api = await import("@/lib/admin-api");
    vi.mocked(api.invokeAdmin).mockResolvedValueOnce({
      campaigns: {
        ...CAMPAIGNS,
        campaigns: CAMPAIGNS.campaigns.filter(
          (c) => c.source === "direct" || c.source === "(pre-attribution)",
        ),
        totals: { tagged_sessions: 0, untagged_sessions: 900, unattributed_paid_users: 11 },
      },
    } as never);

    const { container } = render(
      <CampaignsPanel from="2026-08-01" to="2026-09-01" excludeInternal />,
    );
    await waitFor(() => expect(screen.getByText("Campaign funnel")).toBeInTheDocument());

    // The shape is visible and the reason it is empty is stated.
    expect(container.textContent).toContain("No tagged campaign has been clicked");
    expect(container.textContent).toContain("Sessions");
    expect(container.textContent).toContain("Accounts created");
    // No picker, because there is nothing to pick.
    expect(screen.queryByRole("combobox", { name: "Campaign funnel" })).toBeNull();
  });

  it("keeps untagged sources out of the tagged-sources card", async () => {
    const { container } = await renderPanel();
    const card = container.textContent!.slice(
      container.textContent!.indexOf("Sources (tagged)"),
    );
    // The card is titled "tagged" and sits beside a referrer-derived one, so
    // listing direct here contradicts the funnel above, which excludes it.
    expect(card).toContain("whatsapp");
    expect(card).not.toContain("direct");
    expect(card).not.toContain("(pre-attribution)");
  });
});