/**
 * useUserStatus — fetches the user's onboarding + payment status from DB.
 *
 * Used by route guards (PaidRoute, PaymentRoute) to make routing decisions
 * based on the centralized resolve-destination logic.
 *
 * Caches via @tanstack/react-query (staleTime: 30s).
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { UserState } from "@/lib/resolve-destination";

const USER_STATUS_KEY = "user-status";

export { USER_STATUS_KEY };

interface UserProfileStatus {
  onboardingDone: boolean;
  hasPaid: boolean;
  isAdmin: boolean;
}

async function fetchUserStatus(userId: string): Promise<UserProfileStatus> {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("onboarding_done, has_paid, is_admin")
    .eq("id", userId)
    .single();

  if (error || !data) {
    return { onboardingDone: false, hasPaid: false, isAdmin: false };
  }

  return {
    onboardingDone: data.onboarding_done === true,
    hasPaid: data.has_paid === true,
    isAdmin: data.is_admin === true,
  };
}

export function useUserStatus(): {
  state: UserState;
  /** Kept outside UserState: routing decisions never branch on it, only AdminRoute does. */
  isAdmin: boolean;
  loading: boolean;
} {
  const { user, loading: authLoading } = useAuth();

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: [USER_STATUS_KEY, user?.id],
    queryFn: () => fetchUserStatus(user!.id),
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 60_000, // 1 min — prevents stale paid/unpaid state from persisting on mobile
  });

  const loading = authLoading || (!!user && queryLoading);

  const state: UserState = {
    isAuthenticated: !!user,
    onboardingDone: data?.onboardingDone ?? false,
    hasPaid: data?.hasPaid ?? false,
  };

  return { state, isAdmin: data?.isAdmin ?? false, loading };
}
