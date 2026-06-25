/**
 * Build-stamp accessor used to tell, at a glance, whether the frontend actually
 * reloaded or is serving cached code.
 *
 * In the BUNDLED build, esbuild's `define` (scripts/build/bundle-frontend.js)
 * replaces __BUILD_TIME__ / __BUILD_COMMIT__ with string literals at compile
 * time. In unbundled local dev those identifiers are never declared, so the
 * `typeof` guard is 'undefined' and we report the page-load time instead — which
 * also makes it obvious you're running raw source, not the built bundle.
 */

// `typeof <undeclared>` is safe (never throws). In the bundle esbuild rewrites
// these to `typeof "<literal>"`, which is 'string'. The true branch only
// evaluates the identifier when it was actually defined.
const BUILD_TIME = (typeof __BUILD_TIME__ !== 'undefined') ? __BUILD_TIME__ : null;
const BUILD_COMMIT = (typeof __BUILD_COMMIT__ !== 'undefined') ? __BUILD_COMMIT__ : null;

// Captured once when this module first evaluates. In unbundled mode (no build
// step to stamp) this is the freshness signal: it changes on every fresh load.
const LOADED_AT = new Date();

/**
 * @returns {{ bundled: boolean, time: string|null, commit: string|null, loadedAt: Date }}
 */
export function getBuildInfo() {
  return {
    bundled: BUILD_TIME !== null,
    time: BUILD_TIME,
    commit: BUILD_COMMIT,
    loadedAt: LOADED_AT,
  };
}

/**
 * Human-readable one-liner for display.
 *   bundled:   "build 2026-06-24T19:25:11Z · a1b2c3d · bundled"
 *   unbundled: "unbundled dev — loaded 19:40:02"
 * @returns {string}
 */
export function formatBuildInfo() {
  const { bundled, time, commit, loadedAt } = getBuildInfo();
  if (bundled) {
    const c = commit && commit !== 'unknown' ? ` · ${commit}` : '';
    return `build ${time}${c} · bundled`;
  }
  const hhmmss = loadedAt.toTimeString().slice(0, 8);
  return `unbundled dev — loaded ${hhmmss}`;
}
