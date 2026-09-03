/**
 * Form field reach — which input the onboarding form dies on.
 *
 * The gap this fills: the funnel's first step is `kundali_generated`, so a visitor
 * who opens the birth-details form and abandons it is indistinguishable from one
 * who never looked at it. Both are simply absent from every count. That is the
 * largest single drop in the product and the panel could say nothing about it.
 *
 * One `field_focus` row per named field per mount tells you how far down the form
 * people get: 900 reached the name, 610 reached the date, 240 reached the place.
 * The shape of that decay is the answer, and it needs no "abandon" event —
 * abandonment is the gap between a field's reach and the next field's.
 *
 * **First-party only.** Queued through queueEvent() and never routed through
 * analytics(), the app's one window.dataLayer writer, so nothing here reaches GTM
 * or GA4 and the agreed tag strings are untouched. See ANALYTICS.md →
 * "Admin-only behaviour signals".
 *
 * ── Why one listener rather than per-input handlers ─────────────────────────
 * Same reasoning as click-tracking.ts. This form has ten inputs, several of them
 * split sub-fields (dd/mm/yyyy) with their own onChange plumbing, and a place
 * autocomplete that owns its own input. Editing all of them means remembering to
 * edit the next one too. A single capture-phase focus listener on the <form>
 * cannot miss a field that is added later.
 *
 * Capture phase for the same reason as well: focus does not bubble (focusin does),
 * and React's onFocus is a synthetic bubbling event that a child calling
 * stopPropagation would swallow.
 */

import { useCallback, useRef } from "react";
import type { FocusEvent } from "react";
import { queueEvent } from "./event-queue";
import { isUntrackedPath } from "./tracking-scope";
import { normalisePath } from "./tracked-pages";

/**
 * The field a focused element belongs to.
 *
 * `data-af-field` on an ancestor wins, so a group of sub-inputs (dd/mm/yyyy, or a
 * visible input beside an sr-only native picker) reports as one field rather than
 * three that have to be added back together to mean anything.
 */
function fieldName(el: Element): string | null {
  const group = el.closest("[data-af-field]");
  if (group) return group.getAttribute("data-af-field");

  const named = el.getAttribute("name") || el.getAttribute("id");
  return named || null;
}

/**
 * Report the first focus of each named field in a form.
 *
 * Returns a props object to spread onto the <form>. Once per MOUNT, not once per
 * session: the ref is per component instance, so nothing is stored anywhere that
 * would need clearing in the SIGNED_OUT handler in auth-context.tsx — every
 * user-scoped sessionStorage key has to be added there by hand, and one forgotten
 * key shows the previous user's state to the next person on that browser.
 */
export function useFormFieldTracking(form: string) {
  const seen = useRef<Set<string>>(new Set());

  const onFocusCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      try {
        const target = event.target as Element | null;
        if (!target || typeof target.closest !== "function") return;

        const field = fieldName(target);
        if (!field || seen.current.has(field)) return;

        const path = normalisePath(window.location.pathname);
        if (isUntrackedPath(path)) return;

        seen.current.add(field);
        queueEvent("field_focus", {
          path,
          // `order` is the position in this visitor's own progression through the
          // form, which is what makes a per-field funnel readable: field 1 reached
          // by 900, field 2 by 610. Derived from the set size rather than a
          // declared field list, so it cannot go stale when a field is added.
          props: { form, field, order: seen.current.size },
        });
      } catch {
        /* instrumentation must never break the field the user is filling in */
      }
    },
    [form],
  );

  return { onFocusCapture };
}
