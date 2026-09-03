/**
 * Tests for the shared AI Astrologer conversation store (AF-090).
 *
 * The bug was that the floating widget and the full-page /ai-chat view each
 * held their own message array, so expanding the widget destroyed the
 * conversation. These cover the store contract both views now depend on.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  useChatStore,
  hasStartedChat,
  CHAT_STORAGE_KEY,
  CHAT_INIT_ID,
  type ChatMessage,
} from "../lib/chat-store";

const msg = (id: string, role: ChatMessage["role"] = "user"): ChatMessage => ({
  id,
  role,
  text: `text-${id}`,
});

/**
 * Re-imports the module so its synchronous hydration runs again against the
 * current sessionStorage — the same thing that happens when the full-page view
 * mounts after the widget has unmounted.
 */
async function freshStore() {
  vi.resetModules();
  return import("../lib/chat-store");
}

beforeEach(() => {
  sessionStorage.clear();
  useChatStore.getState().reset();
});

describe("chat store", () => {
  it("starts with only the greeting", () => {
    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(CHAT_INIT_ID);
    expect(messages[0].role).toBe("ai");
  });

  it("treats a lone greeting as not started", () => {
    expect(hasStartedChat(useChatStore.getState().messages)).toBe(false);
  });

  it("appends messages in order and marks the chat started", () => {
    useChatStore.getState().appendMessage(msg("u-1"));
    useChatStore.getState().appendMessage(msg("ai-1", "ai"));

    const { messages } = useChatStore.getState();
    expect(messages.map((m) => m.id)).toEqual([CHAT_INIT_ID, "u-1", "ai-1"]);
    expect(hasStartedChat(messages)).toBe(true);
  });

  it("persists a real conversation to sessionStorage", () => {
    useChatStore.getState().appendMessage(msg("u-1"));

    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).map((m: ChatMessage) => m.id)).toEqual([CHAT_INIT_ID, "u-1"]);
  });

  it("does not leave a key behind for the empty state", () => {
    useChatStore.getState().appendMessage(msg("u-1"));
    useChatStore.getState().reset();
    expect(sessionStorage.getItem(CHAT_STORAGE_KEY)).toBeNull();
  });

  it("reset returns to the greeting alone", () => {
    useChatStore.getState().appendMessage(msg("u-1"));
    useChatStore.getState().appendMessage(msg("ai-1", "ai"));
    useChatStore.getState().reset();

    const { messages } = useChatStore.getState();
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe(CHAT_INIT_ID);
    expect(hasStartedChat(messages)).toBe(false);
  });

  // This is the actual AF-090 regression: a fresh module instance is what the
  // full-page view gets after the widget unmounts on navigation.
  it("rehydrates a stored conversation on a fresh mount", async () => {
    const stored: ChatMessage[] = [
      { id: CHAT_INIT_ID, role: "ai", text: "greeting" },
      { id: "u-1", role: "user", text: "when should I invest?" },
      { id: "ai-1", role: "ai", text: "During your Jupiter Mahadasha." },
    ];
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(stored));

    const mod = await freshStore();
    const messages = mod.useChatStore.getState().messages;

    expect(messages.map((m) => m.id)).toEqual([CHAT_INIT_ID, "u-1", "ai-1"]);
    expect(mod.hasStartedChat(messages)).toBe(true);
  });

  it("falls back to the greeting on malformed stored data", async () => {
    sessionStorage.setItem(CHAT_STORAGE_KEY, "{not json");
    const mod = await freshStore();
    expect(mod.useChatStore.getState().messages).toHaveLength(1);
  });

  it("drops entries that are not chat messages", async () => {
    sessionStorage.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify([{ id: "u-1", role: "user", text: "ok" }, { nope: true }, null]),
    );
    const mod = await freshStore();
    const messages = mod.useChatStore.getState().messages;
    expect(messages).toHaveLength(1);
    expect(messages[0].id).toBe("u-1");
  });
});
