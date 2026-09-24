// Where a repo-relative docs path (e.g. `docs/json/user/overview.md`) is linked.
//
// Lifted from the client console's Overview link (modules/client/ui/mainContentUI.js),
// which the Quick Launch panel shares. The stable build is served under
// `/Archipelago/` and links the stable fork's docs; everything else links the CC repo.

export const STABLE_PATH_PREFIX = '/Archipelago/';
export const STABLE_DOCS_BASE = 'https://github.com/PeerInfinity/Archipelago/blob/JSONExport/';
export const CC_DOCS_BASE = 'https://github.com/PeerInfinity/Archipelago-CC/blob/main/';

/** The values of the Quick Launch `docsLinkTarget` setting. */
export const DOCS_LINK_TARGETS = Object.freeze({ github: 'github', local: 'local' });

/** The GitHub blob base for this build. */
export function docsBase(pathname = window.location.pathname) {
  return pathname.startsWith(STABLE_PATH_PREFIX) ? STABLE_DOCS_BASE : CC_DOCS_BASE;
}

/**
 * The locally served repo root: the app page lives in `frontend/`, and the dev
 * server serves the repo root, so `docs/` is one level up. GitHub Pages copies
 * no user docs, so a link built on this base 404s there.
 */
export function localDocsBase(href = window.location.href) {
  return new URL('../', href).href;
}

/** The href for a repo-relative docs path under the chosen target. */
export function docsHref(path, target = DOCS_LINK_TARGETS.github) {
  return (target === DOCS_LINK_TARGETS.local ? localDocsBase() : docsBase()) + path;
}
