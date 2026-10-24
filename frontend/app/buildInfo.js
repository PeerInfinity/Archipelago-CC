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
 *   bundled:            "build 2026-06-24T19:25:11Z · a1b2c3d · bundled"
 *   unbundled:          "unbundled dev — loaded 19:40:02"
 *   unbundled + stamp:  "unbundled dev — sources 2026-07-03 09:14:02 · loaded 19:40:02"
 *
 * `sourceStamp` is fetchSourceStamp()'s result. BOTH times matter for
 * staleness: "sources" is when the served tree last changed (the dev
 * server's answer — it reflects the DISK, not what this page runs);
 * "loaded" is when this page fetched its code. loaded < sources ⇒ the
 * page is running stale code.
 * @param {{ mtime: Date }|null} [sourceStamp]
 * @returns {string}
 */
export function formatBuildInfo(sourceStamp = null) {
  const { bundled, time, commit, loadedAt } = getBuildInfo();
  if (bundled) {
    const c = commit && commit !== 'unknown' ? ` · ${commit}` : '';
    return `build ${time}${c} · bundled`;
  }
  const hhmmss = loadedAt.toTimeString().slice(0, 8);
  if (sourceStamp?.mtime instanceof Date && !Number.isNaN(sourceStamp.mtime.getTime())) {
    const m = sourceStamp.mtime;
    const pad = (v) => String(v).padStart(2, '0');
    const stamp = `${m.getFullYear()}-${pad(m.getMonth() + 1)}-${pad(m.getDate())}`
      + ` ${pad(m.getHours())}:${pad(m.getMinutes())}:${pad(m.getSeconds())}`;
    return `unbundled dev — sources ${stamp} · loaded ${hhmmss}`;
  }
  return `unbundled dev — loaded ${hhmmss}`;
}

// One fetch per page: the answer only moves when files change, and the
// stamp is re-rendered from the cached promise on every panel rebuild.
let sourceStampPromise = null;

/**
 * The dev server's source-tree stamp (serve-nocache.py `/_source-mtime`:
 * newest file mtime under frontend/). Unbundled dev only — the bundled
 * build's own build time already IS its last-modified stamp. Resolves
 * null when the endpoint is absent (plain `python -m http.server`) or
 * anything else goes wrong: the stamp then stays load-time-only.
 * @returns {Promise<{ mtime: Date, file: string|null }|null>}
 */
export function fetchSourceStamp() {
  if (BUILD_TIME !== null) return Promise.resolve(null);
  sourceStampPromise ??= (async () => {
    try {
      const res = await fetch('/_source-mtime', { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      const mtime = new Date(data.mtime);
      if (Number.isNaN(mtime.getTime())) return null;
      return { mtime, file: data.file ?? null };
    } catch (e) {
      return null;
    }
  })();
  return sourceStampPromise;
}
