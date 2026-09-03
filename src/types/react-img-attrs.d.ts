/**
 * `fetchpriority` on <img>.
 *
 * React 18 declares neither casing of this attribute. The camelCase
 * `fetchPriority` that React 19 added is *dropped with a console warning* by
 * React 18 — "React does not recognize the fetchPriority prop on a DOM element…
 * spell it as lowercase" — which is exactly what the six above-the-fold images
 * in this app were doing: warning on every page load while applying no priority
 * hint at all. React 18 does pass all-lowercase unknown attributes through to
 * the DOM, so lowercase is the spelling that works; this declaration is what
 * makes it type-check.
 *
 * The `import` is load-bearing: without a top-level import this file is a global
 * script and `declare module "react"` *replaces* React's own types instead of
 * augmenting them, which produces ~990 errors rather than fixing 6.
 *
 * Remove this file when upgrading to React 19 and switch the call sites to the
 * camelCase `fetchPriority`.
 */

import "react";

declare module "react" {
  interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    fetchpriority?: "high" | "low" | "auto";
  }
}
