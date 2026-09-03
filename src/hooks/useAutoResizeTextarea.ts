/**
 * Grows a textarea with its content, between a min and max height.
 *
 * Extracted from AstroChat's welcome composer so all three chat inputs (the
 * welcome screen, the full-page chat bar, and the floating widget) share one
 * implementation — they need identical Enter / Shift+Enter behaviour (AF-087).
 */

import { useCallback, useEffect, useRef } from "react";

export function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: {
  minHeight: number;
  maxHeight?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }
      // Collapse first so scrollHeight reflects the content, not the old box.
      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Infinity),
      );
      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  // Measure on mount rather than hard-setting minHeight: a textarea seeded with
  // a value (e.g. a message carried in from another page) needs a box sized to
  // that text, not to one empty line. For an empty textarea adjustHeight()
  // yields exactly minHeight, so this is a no-op in the common case.
  useEffect(() => {
    adjustHeight();
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

/**
 * Enter sends, Shift+Enter inserts a newline (AF-087).
 * Pass the send handler; returns an onKeyDown for a chat textarea.
 */
export function chatSubmitOnEnter(send: () => void) {
  return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };
}
