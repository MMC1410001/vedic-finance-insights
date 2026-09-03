/**
 * LogoutDialog — Confirmation dialog shown when user clicks logout.
 * Offers two choices:
 *   1. Simple Log Out — just signs out normally
 *   2. Clear Data & Delete Account — wipes all user data via edge function, then signs out
 */

import { useState, useEffect } from "react";
import { LogOut, Trash2, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { isTestUser } from "@/lib/test-user";

interface LogoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ADMIN_PASSWORD = "test123";

export const LogoutDialog = ({ open, onOpenChange }: LogoutDialogProps) => {
  const { user, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const showDeleteOption = isTestUser(user?.email);

  // For non-test users, skip the dialog and sign out directly
  useEffect(() => {
    if (open && !showDeleteOption) {
      onOpenChange(false);
      signOut();
    }
  }, [open, showDeleteOption, onOpenChange, signOut]);

  // Don't render the dialog for non-test users
  if (!showDeleteOption) return null;

  const handleSimpleLogout = async () => {
    onOpenChange(false);
    await signOut();
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      // Call edge function to delete user completely (cascades all data)
      await supabase.functions.invoke("admin-user-management", {
        body: {
          action: "delete-user",
          userId: user.id,
          adminPassword: ADMIN_PASSWORD,
        },
      });
    } catch (err) {
      console.error("Failed to delete account:", err);
    } finally {
      setDeleting(false);
      onOpenChange(false);
      // Sign out (the auth state listener will do the hard redirect)
      await signOut();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm border border-white/10 bg-[#1a0a2e] text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-[#F5E9FF]">
            Log Out
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-[#A89BC8]">
            How would you like to log out?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          {/* Simple Log Out */}
          <button
            onClick={handleSimpleLogout}
            disabled={deleting}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-left disabled:opacity-50"
          >
            <LogOut className="w-5 h-5 text-[#C8A2FF] shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#F5E9FF]">Simple Log Out</p>
              <p className="text-xs text-[#A89BC8]">Sign out and keep your data safe</p>
            </div>
          </button>

          {/* Clear Data & Delete Account */}
          <button
            onClick={handleDeleteAccount}
            disabled={deleting}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/15 transition-colors text-left disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="w-5 h-5 text-red-400 shrink-0 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <div>
              <p className="text-sm font-medium text-red-300">Clear Data & Delete Account</p>
              <p className="text-xs text-red-400/70">
                Permanently delete all your data and account
              </p>
            </div>
          </button>
        </div>

        <AlertDialogFooter className="mt-3">
          <AlertDialogCancel
            disabled={deleting}
            className="bg-white/5 border-white/10 text-[#D6C6F5] hover:bg-white/10 hover:text-white"
          >
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
