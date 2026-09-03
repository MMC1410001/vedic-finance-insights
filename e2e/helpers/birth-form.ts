/**
 * Drives BirthDetailsForm (src/components/vedicfinance/BirthDetailsForm.tsx).
 *
 * Date and time are entered through the component's own hidden native
 * <input type="date"> / time element rather than the three visible split boxes.
 * Those boxes auto-advance focus between refs and assemble their value only when
 * every part is filled (updateDateValue / updateTimeValue, lines 154-169) — a
 * far more fragile thing to automate than the picker the component already
 * wires up for the same purpose.
 */

import type { Page } from "@playwright/test";

/** One deterministic Nominatim result, so no third-party call is in the path. */
const PLACE = {
  display_name: "Pune, Maharashtra, India",
  lat: "18.5204",
  lon: "73.8567",
};

/**
 * LocationSearch only emits coordinates when a dropdown suggestion is *clicked*
 * (LocationSearch.tsx:81-89); typing alone submits lat/lng 0 and the AF-091
 * guard rejects it. Stub the geocoder so the suggestion appears instantly and
 * identically every run.
 *
 * financial-summary is stubbed too: /kundali fires it on load and it is a real
 * LLM call. Nothing under test depends on it. generate-report is deliberately
 * NOT stubbed — it is local astronomy math and it is the thing being verified.
 */
export async function stubExternals(page: Page) {
  await page.route("**nominatim.openstreetmap.org/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ ...PLACE, place_id: 1, type: "city", addresstype: "city" }]),
    }),
  );

  await page.route("**/functions/v1/financial-summary", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ summary: "QA stub — financial-summary not exercised." }),
    }),
  );
}

/** The landing CTA reads "Unlock your Financial Kundali for ₹99 FREE". */
export const SUBMIT_LABEL = /Unlock your Financial Kundali/i;

export async function fillBirthForm(page: Page, fullName: string) {
  await page.getByPlaceholder("Enter your full name").fill(fullName);

  // Both pickers start collapsed behind a button.
  await page.getByRole("button", { name: "Enter birth date" }).click();
  await page.getByRole("button", { name: "Enter birth time" }).click();

  // Fill the visible split boxes rather than the component's hidden native
  // <input type="date">. Assigning .value on that element and dispatching an
  // event does NOT reach React — React installs its own value setter and
  // ignores writes that bypass it, so the form kept reporting "Date of birth is
  // required" while the hidden input visibly held 1990-04-15. Driving the real
  // boxes is both correct and closer to what a user does.
  await page.getByPlaceholder("DD").fill("15");
  await page.getByPlaceholder("MM").first().fill("04");   // date MM precedes time MM in the DOM
  await page.getByPlaceholder("YYYY").fill("1990");

  await page.getByPlaceholder("HH").fill("09");
  await page.getByPlaceholder("MM").nth(1).fill("30");    // time minutes

  // Type, wait out the 350ms debounce, then click the suggestion — the click is
  // what attaches latitude/longitude.
  await page.getByPlaceholder("Search your birth place").fill("Pune");
  await page.getByText(PLACE.display_name, { exact: false }).first().click();
}
