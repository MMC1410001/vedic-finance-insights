/**
 * One call path to the admin edge function, with readable errors.
 *
 * Why this exists: `supabase.functions.invoke()` rejects a non-2xx response with
 * a `FunctionsHttpError` whose message is the fixed string
 * "Edge Function returned a non-2xx status code". The body — which is where the
 * function put the actual reason — is only reachable through `error.context`,
 * the raw Response.
 *
 * That turns every deliberate 400 into a useless message. An operator who types
 * a /0 into the internal-traffic card would be told "non-2xx status code"
 * instead of "that range is too broad and could empty the whole panel", so the
 * validation would exist server-side and be invisible where it matters.
 */

import { supabase } from "./supabase";

/** The shape supabase-js attaches to a FunctionsHttpError. */
interface HttpErrorLike {
  context?: { json?: () => Promise<unknown> };
}

/**
 * Call admin-user-management and return its payload.
 *
 * Throws an Error carrying the function's own message when it sent one, and the
 * transport error otherwise. Callers surface `error.message` directly.
 */
export async function invokeAdmin<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke("admin-user-management", { body });

  if (error) {
    const context = (error as unknown as HttpErrorLike).context;
    if (context && typeof context.json === "function") {
      // Read the body the function actually sent. `.json()` can throw on an
      // empty or non-JSON response — a gateway timeout, say — in which case the
      // transport error is the most accurate thing we have.
      const payload = (await context.json().catch(() => null)) as { error?: unknown } | null;
      if (payload && typeof payload.error === "string" && payload.error) {
        throw new Error(payload.error);
      }
    }
    throw error;
  }

  // A 200 can still carry an error field: several actions answer that way rather
  // than failing the request.
  if (data && typeof (data as { error?: unknown }).error === "string") {
    throw new Error((data as { error: string }).error);
  }

  return data as T;
}
