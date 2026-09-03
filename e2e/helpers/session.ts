/**
 * Mint a browser session for a password user without touching Google.
 *
 * supabase-js reads its session from localStorage under `sb-<ref>-auth-token`,
 * so signing in headlessly and writing that key produces exactly the state the
 * app would have after a real OAuth round-trip.
 */

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, ANON_KEY, PROJECT_REF, type TestUser } from "./supabase-admin";
import type { BrowserContext } from "@playwright/test";

export async function signInHeadless(user: TestUser) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error || !data.session) throw new Error(`signInHeadless failed: ${error?.message}`);
  return data.session;
}

/** Inject the session into a context before any page script runs. */
export async function applySession(context: BrowserContext, session: unknown) {
  const key = `sb-${PROJECT_REF}-auth-token`;
  await context.addInitScript(
    ([k, v]) => {
      try {
        window.localStorage.setItem(k as string, v as string);
      } catch { /* storage disabled */ }
    },
    [key, JSON.stringify(session)],
  );
}
