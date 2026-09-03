/**
 * useChatAccess — the shared "open the AI Astrologer" action.
 *
 * Every chatbot entry point calls `openChat()`. It resolves the user's state
 * against the policy in lib/chat-access.ts, shows a toast explaining any
 * blocker, and navigates to wherever the user can resolve it.
 */

import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useUserStatus } from "@/hooks/useUserStatus";
import {
  chatDenial,
  chatDestination,
  CHAT_DENIAL_MESSAGE,
  type ChatDenial,
} from "@/lib/chat-access";

export function useChatAccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state, loading } = useUserStatus();

  /**
   * @param initialMessage Text the user already typed (e.g. the dashboard's
   *   "Ask about fin-astrology…" box), carried into the chat via router state.
   */
  const openChat = useCallback((initialMessage?: string) => {
    // Status still resolving — a denial computed now could be a false negative
    // (unauthenticated by default), which is what sent users to /home mid-load.
    if (loading) return;

    // Several call sites wire this straight to onClick/onAiChat, which hands us
    // the click event as the first argument. Router state goes through
    // history.pushState, and a SyntheticEvent is not structured-cloneable — it
    // threw DataCloneError and the navigation silently never happened, so the
    // kundali sidebar's chat button did nothing for users who were allowed in.
    const message = typeof initialMessage === "string" ? initialMessage : undefined;

    const denial: ChatDenial = chatDenial(state);
    if (denial) {
      toast.info(CHAT_DENIAL_MESSAGE[denial], { duration: 4000 });
      navigate(chatDestination(denial));
      return;
    }

    // `from` lets the chat's back button return to a real page. It cannot use
    // history: sign-in is a full-page Google redirect, so after an auth round
    // trip the entry beneath /ai-chat is the OAuth URL, not an app route.
    navigate(chatDestination(null), {
      state: {
        ...(message ? { initialMessage: message } : {}),
        from: location.pathname + location.search,
      },
    });
  }, [loading, state, navigate, location.pathname, location.search]);

  return { openChat, loading };
}
