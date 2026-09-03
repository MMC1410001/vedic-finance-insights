/**
 * CardFeedback — subtle thumbs up/down buttons for each insight card.
 * Positioned at the bottom-right of the card. Clicking triggers the
 * feedback panel at bottom-left of the viewport.
 */

import { type ReactNode } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { motion } from "framer-motion";
import { useFeedbackStore, type Vote } from "@/lib/feedback-store";
import { useAuth } from "@/lib/auth-context";

interface Props {
  cardId: string;
}

export default function CardFeedback({ cardId }: Props) {
  const { user } = useAuth();
  const vote = useFeedbackStore((s) => s.votes[cardId]);
  const submitVote = useFeedbackStore((s) => s.submitVote);

  const handleVote = (v: Vote) => {
    submitVote(cardId, v, user?.id);
  };

  return (
    <div className="flex items-center gap-1.5" data-pdf-hide>
      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => handleVote("up")}
        className="p-1 rounded-md transition-colors"
        style={{
          background: vote === "up" ? "rgba(47,191,159,0.15)" : "transparent",
          border: vote === "up" ? "1px solid rgba(47,191,159,0.3)" : "1px solid transparent",
        }}
        title="Helpful"
        aria-label="Mark as helpful"
      >
        <ThumbsUp
          className="h-3.5 w-3.5"
          style={{
            color: vote === "up" ? "#2FBF9F" : "rgba(168,155,200,0.4)",
          }}
          fill={vote === "up" ? "rgba(47,191,159,0.3)" : "none"}
        />
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => handleVote("down")}
        className="p-1 rounded-md transition-colors"
        style={{
          background: vote === "down" ? "rgba(224,107,170,0.15)" : "transparent",
          border: vote === "down" ? "1px solid rgba(224,107,170,0.3)" : "1px solid transparent",
        }}
        title="Not helpful"
        aria-label="Mark as not helpful"
      >
        <ThumbsDown
          className="h-3.5 w-3.5"
          style={{
            color: vote === "down" ? "#E06BAA" : "rgba(168,155,200,0.4)",
          }}
          fill={vote === "down" ? "rgba(224,107,170,0.3)" : "none"}
        />
      </motion.button>
    </div>
  );
}

/**
 * CardFeedbackWrapper — wraps a card component and adds thumbs up/down
 * at the bottom-right corner. Use this around each card in the page.
 */
export function CardFeedbackWrapper({
  cardId,
  children,
}: {
  cardId: string;
  children: ReactNode;
}) {
  return (
    <div className="relative h-full">
      {children}
      {/* Sits nearer the card edge than the content it floats over. Lowering
          this offset only ever increases the clear space above the thumbs, so
          it cannot crowd a card that was already tuned for the old value. */}
      <div className="absolute bottom-2.5 right-3 sm:bottom-3 sm:right-4 z-10">
        <CardFeedback cardId={cardId} />
      </div>
    </div>
  );
}
