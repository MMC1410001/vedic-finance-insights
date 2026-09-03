import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { useUserStatus } from "@/hooks/useUserStatus";
import { getRedirectForRoute, type RouteRequirement } from "@/lib/resolve-destination";
import { isHeatmapPreview } from "@/lib/tracking-scope";

interface Props {
  children: React.ReactNode;
  /**
   * Level of access required:
   * - "auth" (default) — user must be authenticated
   * - "onboarded" — user must be authenticated + have completed onboarding
   */
  require?: RouteRequirement;
}

const ProtectedRoute = ({ children, require = "auth" }: Props) => {
  const { loading: authLoading } = useAuth();
  const { state, loading } = useUserStatus();
  const isGuest = sessionStorage.getItem("guestMode") === "true";

  /**
   * The /admin heatmap frames the real route to draw the click map over it, and
   * getRedirectForRoute() answers "/home" for anyone unauthenticated — so every
   * guarded page showed the Landing page under its own label. Seven of the 21
   * catalogue pages are behind this guard, which made their heatmaps unreadable.
   *
   * Rendering `children` here is safe for the reason isHeatmapPreview() documents:
   * it demands ?embed=true AND ?preview=heatmap AND an actual parent frame, so a
   * hand-typed URL cannot reach past a guard. The frame is also
   * pointer-events: none, so nothing inside it can be operated.
   *
   * The page renders in its signed-out shape when the frame has no session. That
   * is the right *route* with empty data, which is what a backdrop needs to be —
   * unlike a different page entirely.
   */
  if (isHeatmapPreview()) return <>{children}</>;

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Guest mode bypasses all checks
  if (isGuest) {
    return <>{children}</>;
  }

  const redirect = getRedirectForRoute(state, require);
  if (redirect) {
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
