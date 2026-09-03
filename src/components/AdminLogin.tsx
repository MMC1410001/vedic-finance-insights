/**
 * AdminLogin — the sign-in / access-denied card rendered in place of /admin.
 *
 * Covers both states so the URL never leaves /admin: an anonymous visitor gets a
 * Google button, and a signed-in non-admin gets told which account they are on
 * plus a way to switch. Previously both cases silently redirected to /home,
 * which made the panel reachable only by generating a kundali, signing in
 * through that flow, then typing /admin by hand — and gave no clue when Google
 * had auto-picked the wrong account.
 *
 * This is presentation only. The security boundary is
 * `requireUser(req, { requireAdmin: true })` inside the admin-user-management
 * edge function, which runs with the service-role key.
 */

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const AdminLogin = ({ deniedEmail }: { deniedEmail?: string | null }) => {
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);

  const signIn = async () => {
    setLoading(true);
    // No sessionStorage "authMode" write — see KundaliAuthPage: a stale
    // authMode="signin" makes AuthPage treat the next visit as a failed
    // sign-in and delete the just-created account.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Return to /admin itself, so nobody has to retype the URL.
        redirectTo: `${window.location.origin}/admin`,
        // Force the account chooser. Without it Google silently reuses whatever
        // session the browser already has, which is how a personal account got
        // picked over the granted work one.
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) setLoading(false);
  };

  const switchAccount = async () => {
    setLoading(true);
    // auth-context reads this on SIGNED_OUT and hard-redirects there, so the
    // user lands back on this card rather than /home.
    sessionStorage.setItem("signOutRedirect", "/admin");
    await signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-sm rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-xl font-bold text-white mb-1">Admin Panel</h1>

        {deniedEmail ? (
          <>
            <div className="flex items-start gap-2.5 mt-4 mb-5 px-3 py-2.5 rounded-lg bg-orange-950/30 border border-orange-700/40">
              <ShieldAlert className="w-4 h-4 shrink-0 text-orange-400 mt-0.5" />
              <p className="text-xs text-orange-200 leading-relaxed">
                <span className="font-semibold">{deniedEmail}</span> does not have admin
                access. Sign in with an account that does.
              </p>
            </div>
            <button
              onClick={switchAccount}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-white text-gray-900 font-semibold transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? "Signing out…" : "Sign in with a different account"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-400 mb-6">Sign in to continue.</p>
            <button
              onClick={signIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-lg bg-white text-gray-900 font-semibold transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              <GoogleIcon />
              {loading ? "Redirecting…" : "Continue with Google"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminLogin;
