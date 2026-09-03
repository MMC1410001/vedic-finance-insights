/**
 * AdminRoute — wraps /admin.
 *
 * This is UX, not the security boundary. The real gate is `requireUser(req,
 * { requireAdmin: true })` inside the admin-user-management edge function,
 * which runs with the service-role key. A client guard cannot be trusted —
 * that was exactly the flaw in the shared ADMIN_PASSWORD it replaces, which
 * shipped in the JS bundle for anyone to read.
 *
 * Three states, all rendered at /admin so the URL never changes and the OAuth
 * return lands back here:
 *   - resolving       -> spinner
 *   - signed out      -> sign-in card
 *   - not an admin    -> access-denied card naming the account
 *
 * Redirecting instead (the earlier behaviour) hid that /admin exists, but it
 * also left no way in short of generating a kundali, signing in through that
 * flow, and typing the URL by hand — and said nothing when Google had
 * auto-selected the wrong account.
 */

import { useUserStatus } from "@/hooks/useUserStatus";
import { useAuth } from "@/lib/auth-context";
import AdminLogin from "@/components/AdminLogin";

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin, loading } = useUserStatus();
  const { user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <span className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <AdminLogin />;
  if (!isAdmin) return <AdminLogin deniedEmail={user.email} />;

  return <>{children}</>;
};

export default AdminRoute;
