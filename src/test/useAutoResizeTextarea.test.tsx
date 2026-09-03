/**
 * Tests for the chat composer auto-resize contract.
 *
 * Two defects motivated these:
 *   1. The mount effect hard-set `height = minHeight` without measuring, so a
 *      textarea seeded with a value (a message carried in from another page)
 *      rendered in a one-line box with the rest of the text hidden.
 *   2. Callers passed a `minHeight` smaller than their own line-height plus
 *      padding, so the resting box was shorter than the single line it held.
 *
 * jsdom does not lay text out, so `scrollHeight` is stubbed to model the real
 * thing: lines * lineHeight + vertical padding, under border-box sizing.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { render } from "@testing-library/react";
import { useAutoResizeTextarea } from "../hooks/useAutoResizeTextarea";

const LINE_HEIGHT = 20;
const PAD_Y = 12; // py-1.5 top + bottom, as the /ai-chat bar uses

let originalScrollHeight: PropertyDescriptor | undefined;

beforeAll(() => {
  originalScrollHeight = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "scrollHeight",
  );
  Object.defineProperty(HTMLTextAreaElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLTextAreaElement) {
      const lines = Math.max(1, this.value.split("\n").length);
      return lines * LINE_HEIGHT + PAD_Y;
    },
  });
});

afterAll(() => {
  delete (HTMLTextAreaElement.prototype as unknown as Record<string, unknown>)
    .scrollHeight;
  if (originalScrollHeight) {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", originalScrollHeight);
  }
});

function Composer({
  initialValue = "",
  minHeight = 32,
  maxHeight = 96,
}: {
  initialValue?: string;
  minHeight?: number;
  maxHeight?: number;
}) {
  const { textareaRef } = useAutoResizeTextarea({ minHeight, maxHeight });
  return <textarea ref={textareaRef} defaultValue={initialValue} data-testid="ta" />;
}

const heightOf = (el: HTMLElement) => parseInt(el.style.height, 10);

describe("useAutoResizeTextarea", () => {
  it("rests at minHeight when empty", () => {
    const { getByTestId } = render(<Composer />);
    expect(heightOf(getByTestId("ta"))).toBe(32);
  });

  it("sizes to a seeded multi-line value on mount, not to one line", () => {
    const { getByTestId } = render(<Composer initialValue={"one\ntwo\nthree"} />);
    // 3 lines * 20 + 12 padding = 72, well above the 32px resting height.
    expect(heightOf(getByTestId("ta"))).toBe(72);
  });

  it("caps a long seeded value at maxHeight so the box cannot run away", () => {
    const many = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const { getByTestId } = render(<Composer initialValue={many} />);
    expect(heightOf(getByTestId("ta"))).toBe(96);
  });

  it("never rests below minHeight even when the content measures smaller", () => {
    // minHeight deliberately larger than one line + padding.
    const { getByTestId } = render(<Composer minHeight={64} />);
    expect(heightOf(getByTestId("ta"))).toBe(64);
  });

  it("matches the /ai-chat bar geometry: one line fills the 32px button row", () => {
    const { getByTestId } = render(<Composer initialValue="hello" />);
    // LINE_HEIGHT + PAD_Y === 32 === the h-8 send button beside it.
    expect(heightOf(getByTestId("ta"))).toBe(32);
  });
});
