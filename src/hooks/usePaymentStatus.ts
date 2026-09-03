/**
 * usePaymentStatus — Supabase-backed payment status for the current user.
 *
 * A thin projection of useUserStatus rather than its own query. It used to run
 * a second, independent query for the same `user_profiles.has_paid` column
 * under its own key, and the two could disagree for up to a staleTime: route
 * guards read one while pages read the other, so /ai-chat and /payment would
 * bounce the user back and forth with `replace` and never settle.
 *
 * One query key means the guards cannot disagree. The
 * `{ hasPaid, loading, refetch }` shape is unchanged for callers.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useUserStatus, USER_STATUS_KEY } from "@/hooks/useUserStatus";

export function usePaymentStatus() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { state, loading } = useUserStatus();

  const refetch = () => {
    if (user) {
      queryClient.invalidateQueries({ queryKey: [USER_STATUS_KEY, user.id] });
    }
  };

  return {
    hasPaid: state.hasPaid,
    loading: loading && !!user,
    refetch,
  };
}
