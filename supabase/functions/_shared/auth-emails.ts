/**
 * Auth user lookup for admin views.
 *
 * Email lives only in `auth.users` — neither `user_profiles` nor
 * `user_birth_details` has the column — so it is reachable exclusively through
 * the Admin Auth API under the service-role key.
 *
 * This module exists because of the page size. `listUsers()` with no `perPage`
 * defaults to **50 users**, and the admin panel's `list-users` called it that
 * way: past 50 accounts every extra user's email came back `null` while their
 * row still rendered — indistinguishable from "no email on file". The orphan
 * handlers passed `perPage: 1000` and so hid the same class of bug one order of
 * magnitude further out. Paging properly is the fix, and it belongs in one
 * place rather than being re-decided at each call site.
 */

// The Supabase client's generic parameters are irrelevant here and naming them
// would drag the Database type into a shared module. Callers pass their own
// service-role client.
// deno-lint-ignore no-explicit-any
type AdminClient = any;

// deno-lint-ignore no-explicit-any
type AuthUser = any;

/** Supabase caps perPage at 1000; asking for more is silently clamped. */
const PAGE_SIZE = 1000;

/**
 * Hard stop on paging. 50 pages is 50k users — far beyond this product — and
 * without it a malformed response that never shortens would loop forever.
 */
const MAX_PAGES = 50;

/**
 * Every auth user, across all pages.
 *
 * On a page error it returns what it has rather than throwing: for the callers
 * here a partial list degrades to a missing email or an unlisted orphan, which
 * is strictly better than an error page.
 */
export async function fetchAllAuthUsers(supabaseAdmin: AdminClient): Promise<AuthUser[]> {
  const users: AuthUser[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });

    if (error) {
      console.error(`fetchAllAuthUsers: page ${page} failed: ${error.message}`);
      break;
    }

    const batch = data?.users ?? [];
    users.push(...batch);

    // A short page is the last page.
    if (batch.length < PAGE_SIZE) break;

    if (page === MAX_PAGES) {
      console.warn(`fetchAllAuthUsers: stopped at ${MAX_PAGES} pages; the list is truncated`);
    }
  }

  return users;
}

/** `auth.users.id -> email`, covering every account rather than the first page. */
export async function fetchEmailMap(supabaseAdmin: AdminClient): Promise<Map<string, string>> {
  const emailMap = new Map<string, string>();

  for (const u of await fetchAllAuthUsers(supabaseAdmin)) {
    if (u?.id) emailMap.set(u.id, u.email || "");
  }

  return emailMap;
}
