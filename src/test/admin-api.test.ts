import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import { supabase } from "@/lib/supabase";
import { invokeAdmin } from "@/lib/admin-api";

const invoke = vi.mocked(supabase.functions.invoke);

/** What supabase-js hands back for a non-2xx: a fixed message plus the Response. */
const httpError = (status: number, body: unknown) =>
  Object.assign(new Error("Edge Function returned a non-2xx status code"), {
    context: { status, json: () => Promise.resolve(body) },
  });

beforeEach(() => invoke.mockReset());

describe("invokeAdmin", () => {
  it("returns the payload on success", async () => {
    invoke.mockResolvedValue({ data: { success: true, entries: [1, 2] }, error: null });
    await expect(invokeAdmin({ action: "list-internal-traffic" })).resolves.toEqual({
      success: true,
      entries: [1, 2],
    });
  });

  /**
   * The whole reason this module exists. supabase-js reports every non-2xx with
   * the same fixed string and puts the real reason in the untouched Response, so
   * without unwrapping it an operator who types a bad range is told
   * "non-2xx status code" and the server-side validation is invisible.
   */
  it("surfaces the function's own message instead of the status-code string", async () => {
    invoke.mockResolvedValue({
      data: null,
      error: httpError(400, { error: "/0 is too broad: it would hide far more than an office." }),
    });

    await expect(invokeAdmin({ action: "add-internal-network" })).rejects.toThrow(/too broad/);
  });

  it("falls back to the transport error when the body carries no message", async () => {
    invoke.mockResolvedValue({ data: null, error: httpError(502, { unrelated: true }) });
    await expect(invokeAdmin({ action: "x" })).rejects.toThrow(/non-2xx/);
  });

  it("survives a body that is not JSON at all", async () => {
    // A gateway timeout returns HTML; .json() throws, and the transport error is
    // then the most accurate thing available.
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: { status: 504, json: () => Promise.reject(new SyntaxError("Unexpected token <")) },
    });
    invoke.mockResolvedValue({ data: null, error });
    await expect(invokeAdmin({ action: "x" })).rejects.toThrow(/non-2xx/);
  });

  it("throws on an error field inside a 200, which several actions use", async () => {
    invoke.mockResolvedValue({ data: { error: "Failed to compute analytics: relation does not exist" }, error: null });
    await expect(invokeAdmin({ action: "analytics-overview" })).rejects.toThrow(/relation does not exist/);
  });

  it("passes an error through untouched when there is no Response to read", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("Failed to fetch") });
    await expect(invokeAdmin({ action: "x" })).rejects.toThrow("Failed to fetch");
  });
});
