/**
 * PaidRoute — wraps routes that require authentication + onboarding + payment.
 *
 * Today that is only /ai-chat (the AI Astrologer), so the denial policy lives
 * in lib/chat-access.ts and is shared with every in-app chatbot button:
 * - Not authenticated / not onboarded → /auth?intent=ai-chat
 * - Not paid                          → /payment
 *
 * Each bounce raises a toast, otherwise the user lands somewhere unexpected
 * with no idea why.
 *
 * Note there is no guest-mode bypass here. ProtectedRoute still honours
 * sessionStorage.guestMode for auth-only routes, but letting it through this
 * guard would waive payment outright.
 */

import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserStatus } from "@/hooks/useUserStatus";
import { chatDenial, chatDestination, CHAT_DENIAL_MESSAGE } from "@/lib/chat-access";
import { isHeatmapPreview } from "@/lib/tracking-scope";

const PaidRoute = ({ children }: { children: React.ReactNode }) => {
  const { state, loading } = useUserStatus();
  /**
   * Same reasoning as ProtectedRoute: the /admin heatmap frames this route to draw
   * the click map over it, and an unpaid or unauthenticated frame bounced to
   * /payment or /home — so the heatmap for /ai-chat showed a different page.
   *
   * Resolved before chatDenial() rather than beside the Navigate, so the toast
   * below does not fire either. isHeatmapPreview() requires a genuine parent
   * frame, which is what keeps this from waiving payment in a real tab.
   */
  const preview = isHeatmapPreview();
  const denial = loading || preview ? null : chatDenial(state);

  useEffect(() => {
    if (denial) toast.info(CHAT_DENIAL_MESSAGE[denial], { duration: 4000 });
  }, [denial]);

  if (preview) return <>{children}</>;

  // Show loading spinner while status resolves
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (denial) {
    return <Navigate to={chatDestination(denial)} replace />;
  }

  return <>{children}</>;
};

export default PaidRoute;
