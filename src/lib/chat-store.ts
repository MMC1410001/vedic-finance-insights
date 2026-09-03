/**
 * Zustand store for the AI Astrologer conversation.
 *
 * The chat is rendered by two separate components — the floating widget
 * (`FloatingAstrologerChat`) and the full-page view (`AstroChat`). Expanding
 * the widget navigates to /ai-chat, which unmounts the widget and mounts the
 * page; before this store existed each held its own `useState` array, so the
 * conversation was destroyed on every transition (AF-090).
 *
 * Hydrates synchronously from sessionStorage on creation, mirroring
 * `report-store.ts`, so a reload or a route change resumes mid-conversation
 * with no flash of the welcome state.
 *
 * NOTE: `CHAT_STORAGE_KEY` is user-scoped and MUST stay in the SIGNED_OUT
 * handler in `auth-context.tsx`, or the next user on this browser inherits
 * the previous user's conversation.
 */

import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "ai";
  text: string;
}

export const CHAT_STORAGE_KEY = "vedicfinanceChat";

/** The id of the greeting. Excluded from the history sent to the edge function. */
export const CHAT_INIT_ID = "init";

const INIT_MESSAGE: ChatMessage = {
  id: CHAT_INIT_ID,
  role: "ai",
  text: "Namaste! I'm your Vedic Financial Astrologer. I analyze your birth chart using real planetary calculations: Vimshottari Dasha, transits, house lords, and financial yogas. Ask me anything about your financial astrology.",
};

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    typeof m.text === "string" &&
    (m.role === "user" || m.role === "ai")
  );
}

// ── Synchronous hydration from sessionStorage ───────────────────────────────

function hydrate(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [INIT_MESSAGE];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [INIT_MESSAGE];
    const messages = parsed.filter(isChatMessage);
    return messages.length > 0 ? messages : [INIT_MESSAGE];
  } catch {
    return [INIT_MESSAGE];
  }
}

function persist(messages: ChatMessage[]) {
  try {
    // A lone greeting is the empty state — don't leave a key behind for it.
    if (messages.length <= 1) sessionStorage.removeItem(CHAT_STORAGE_KEY);
    else sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  } catch {
    /* private mode / quota — the in-memory store still works for this tab */
  }
}

interface ChatState {
  messages: ChatMessage[];
  appendMessage: (message: ChatMessage) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: hydrate(),
  appendMessage: (message) =>
    set((state) => {
      const messages = [...state.messages, message];
      persist(messages);
      return { messages };
    }),
  reset: () => {
    persist([INIT_MESSAGE]);
    set({ messages: [INIT_MESSAGE] });
  },
}));

/**
 * True once the user has sent at least one message — i.e. anything beyond the
 * greeting exists. Drives whether the full-page view shows the welcome screen
 * or the conversation.
 */
export const hasStartedChat = (messages: ChatMessage[]) => messages.length > 1;
