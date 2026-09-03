/**
 * FeedbackPanel — bottom-left floating panel that appears after a vote.
 * Allows the user to optionally leave a short comment.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send } from "lucide-react";
import { useFeedbackStore } from "@/lib/feedback-store";
import { useAuth } from "@/lib/auth-context";

export default function FeedbackPanel() {
  const { user } = useAuth();
  const panelOpen = useFeedbackStore((s) => s.panelOpen);
  const lastVotedCard = useFeedbackStore((s) => s.lastVotedCard);
  const vote = useFeedbackStore((s) => (lastVotedCard ? s.votes[lastVotedCard] : null));
  const submitComment = useFeedbackStore((s) => s.submitComment);
  const closePanel = useFeedbackStore((s) => s.closePanel);

  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const hasValidComment = comment.trim().length > 0;

  const handleSubmit = () => {
    if (!hasValidComment) return;
    if (lastVotedCard) {
      submitComment(lastVotedCard, comment.trim(), user?.id);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        setComment("");
      }, 1500);
    }
  };

  const handleClose = () => {
    closePanel();
    setComment("");
    setSubmitted(false);
  };

  return (
    <AnimatePresence>
      {panelOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-6 left-6 z-[60] w-[280px] sm:w-[320px] feedback-panel"
          style={{
            background: "rgba(42,14,74,0.95)",
            border: "1px solid rgba(242,197,114,0.2)",
            borderRadius: "16px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(242,197,114,0.1)",
          }}
          data-pdf-hide
        >
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: vote === "up" ? "#2FBF9F" : "#E06BAA" }}
              >
                {submitted
                  ? "✓ Thanks!"
                  : vote === "up"
                    ? "👍 Glad it helped!"
                    : "👎 Sorry about that"}
              </span>
              <button
                onClick={handleClose}
                className="p-1 rounded-md hover:bg-white/5 transition-colors"
              >
                <X className="h-3.5 w-3.5" style={{ color: "rgba(168,155,200,0.5)" }} />
              </button>
            </div>

            {/* Comment input */}
            {!submitted && (
              <>
                <p
                  className="text-[11px] mb-2"
                  style={{ color: "rgba(214,198,245,0.5)" }}
                >
                  Any feedback? (optional)
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && hasValidComment && handleSubmit()}
                    placeholder="Tell us more…"
                    className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#D6C6F5",
                    }}
                    maxLength={200}
                  />
                  <motion.button
                    whileHover={hasValidComment ? { scale: 1.05 } : {}}
                    whileTap={hasValidComment ? { scale: 0.95 } : {}}
                    onClick={handleSubmit}
                    disabled={!hasValidComment}
                    className="px-3 py-2 rounded-lg flex items-center gap-1 transition-opacity"
                    style={{
                      background: "linear-gradient(135deg, #F2C572, #FFDFA3)",
                      color: "#2A0E4A",
                      opacity: hasValidComment ? 1 : 0.4,
                      cursor: hasValidComment ? "pointer" : "not-allowed",
                    }}
                    aria-label="Submit feedback"
                  >
                    <Send className="h-3 w-3" />
                  </motion.button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
