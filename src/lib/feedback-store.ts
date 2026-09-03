/**
 * Feedback store — manages card feedback state and Supabase persistence.
 *
 * Table schema (create in Supabase):
 *   CREATE TABLE card_feedback (
 *     id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id UUID REFERENCES auth.users(id),
 *     card_id TEXT NOT NULL,
 *     vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
 *     comment TEXT,
 *     created_at TIMESTAMPTZ DEFAULT now()
 *   );
 *
 *   -- RLS: users can insert/update their own feedback
 *   ALTER TABLE card_feedback ENABLE ROW LEVEL SECURITY;
 *   CREATE POLICY "Users can insert own feedback" ON card_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
 *   CREATE POLICY "Users can update own feedback" ON card_feedback FOR UPDATE USING (auth.uid() = user_id);
 *   CREATE POLICY "Users can read own feedback" ON card_feedback FOR SELECT USING (auth.uid() = user_id);
 */

import { create } from "zustand";
import { useEffect, useRef } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth-context";

export type Vote = "up" | "down";

interface FeedbackEntry {
  cardId: string;
  vote: Vote;
  comment?: string;
}

interface FeedbackState {
  /** Map of cardId → vote */
  votes: Record<string, Vote>;
  /** Whether initial load from DB has completed */
  loaded: boolean;
  /** Whether the bottom-left feedback panel is visible */
  panelOpen: boolean;
  /** The card that was just voted on (for the panel) */
  lastVotedCard: string | null;
  /** Load existing votes from Supabase for the current user */
  loadVotes: (userId: string) => Promise<void>;
  /** Submit a vote */
  submitVote: (cardId: string, vote: Vote, userId?: string) => Promise<void>;
  /** Submit optional comment for the last voted card */
  submitComment: (cardId: string, comment: string, userId?: string) => Promise<void>;
  /** Close the feedback panel */
  closePanel: () => void;
  /** Reset store (e.g. on sign-out) */
  reset: () => void;
}

export const useFeedbackStore = create<FeedbackState>((set, get) => ({
  votes: {},
  loaded: false,
  panelOpen: false,
  lastVotedCard: null,

  loadVotes: async (userId) => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("card_feedback")
        .select("card_id, vote")
        .eq("user_id", userId);

      if (error) {
        console.error("[FeedbackStore] Failed to load votes:", error.message);
        set({ loaded: true });
        return;
      }

      const votes: Record<string, Vote> = {};
      for (const row of data ?? []) {
        votes[row.card_id] = row.vote as Vote;
      }
      set({ votes, loaded: true });
    } catch (err) {
      console.error("[FeedbackStore] Unexpected error loading votes:", err);
      set({ loaded: true });
    }
  },

  submitVote: async (cardId, vote, userId) => {
    const prev = get().votes[cardId];
    // Toggle off if same vote
    if (prev === vote) {
      set((s) => {
        const { [cardId]: _, ...rest } = s.votes;
        return { votes: rest, panelOpen: false, lastVotedCard: null };
      });
      // Delete from Supabase
      if (userId) {
        await supabase
          .from("card_feedback")
          .delete()
          .eq("user_id", userId)
          .eq("card_id", cardId);
      }
      return;
    }

    set((s) => ({
      votes: { ...s.votes, [cardId]: vote },
      panelOpen: true,
      lastVotedCard: cardId,
    }));

    // Upsert to Supabase
    if (userId) {
      await supabase.from("card_feedback").upsert(
        { user_id: userId, card_id: cardId, vote },
        { onConflict: "user_id,card_id" },
      );
    }
  },

  submitComment: async (cardId, comment, userId) => {
    set({ panelOpen: false });
    if (userId) {
      await supabase
        .from("card_feedback")
        .update({ comment })
        .eq("user_id", userId)
        .eq("card_id", cardId);
    }
  },

  closePanel: () => set({ panelOpen: false }),

  reset: () => set({ votes: {}, loaded: false, panelOpen: false, lastVotedCard: null }),
}));

/**
 * Hook to load existing feedback votes from Supabase when the user is authenticated.
 * Call this once in the page/layout that renders feedback cards.
 */
export function useFeedbackLoader() {
  const { user } = useAuth();
  const loadVotes = useFeedbackStore((s) => s.loadVotes);
  const loaded = useFeedbackStore((s) => s.loaded);
  const loadedForRef = useRef<string | null>(null);

  useEffect(() => {
    // Load votes when user becomes available and hasn't been loaded for this user yet
    if (user?.id && loadedForRef.current !== user.id) {
      loadedForRef.current = user.id;
      loadVotes(user.id);
    }
    // Reset if user signs out
    if (!user && loadedForRef.current) {
      loadedForRef.current = null;
      useFeedbackStore.getState().reset();
    }
  }, [user, loadVotes]);
}
