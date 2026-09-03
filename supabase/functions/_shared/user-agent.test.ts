import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { classifyUserAgent } from "./user-agent.ts";

const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const SAFARI_IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const EDGE_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0";
const FIREFOX_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

Deno.test("classifies a phone", () => {
  assertEquals(classifyUserAgent(CHROME_ANDROID), {
    device: "mobile",
    browser: "Chrome",
    os: "Android",
  });
});

// Chrome's UA also contains "Safari", so a naive check reports every Chrome
// visitor as a Safari one. This is the ordering that prevents it.
Deno.test("does not mistake Chrome for Safari", () => {
  assertEquals(classifyUserAgent(CHROME_MAC).browser, "Chrome");
  assertEquals(classifyUserAgent(SAFARI_IPHONE).browser, "Safari");
});

// Same trap in the other direction: Edge, Opera and Samsung Internet all carry
// "Chrome", so they collapse into Chrome unless tested first.
Deno.test("does not mistake Edge for Chrome", () => {
  assertEquals(classifyUserAgent(EDGE_WINDOWS), {
    device: "desktop",
    browser: "Edge",
    os: "Windows",
  });
});

Deno.test("treats an Android UA without 'mobile' as a tablet", () => {
  assertEquals(classifyUserAgent(ANDROID_TABLET).device, "tablet");
});

// iPad reports "Macintosh" in desktop-mode Safari; the iPad token has to win.
Deno.test("classifies an iPad as a tablet running iOS", () => {
  const facts = classifyUserAgent(SAFARI_IPAD);
  assertEquals(facts.device, "tablet");
  assertEquals(facts.os, "iOS");
});

Deno.test("classifies desktop Firefox on Linux", () => {
  assertEquals(classifyUserAgent(FIREFOX_LINUX), {
    device: "desktop",
    browser: "Firefox",
    os: "Linux",
  });
});

Deno.test("flags obvious crawlers rather than filing them as a browser", () => {
  assertEquals(classifyUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)").browser, "Bot");
  assertEquals(classifyUserAgent("HeadlessChrome/120.0").browser, "Bot");
});

// A missing UA must produce nulls, not "desktop"/"Other" — otherwise the
// devices breakdown quietly attributes unknown traffic to desktop.
Deno.test("returns nulls when there is no user agent at all", () => {
  assertEquals(classifyUserAgent(null), { device: null, browser: null, os: null });
  assertEquals(classifyUserAgent(""), { device: null, browser: null, os: null });
});
