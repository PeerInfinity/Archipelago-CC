// Shared known iframe pages configuration
// Used by iframeManagerPanel UI and URL parameter handling
//
// Registering an external-URL (remote) module
// -------------------------------------------
// Each entry's `url` may be a relative path (same-origin, served from this
// app) OR an absolute URL to a remote module. To register a remote module,
// add an entry with an absolute `url`, e.g.:
//
//   { name: "Example Remote", url: "https://example.github.io/my-module/index-iframe.html",
//     description: "...", shortName: "exampleremote" }
//
// A registered entry loads without the custom-URL risk warning; ad-hoc URLs
// typed into the Iframe Manager are treated as custom and warn first.
//
// Two remote cases (see CC/docs/plans/completed/external-iframe-modules.md):
//  - Same-origin remote — a different path on this app's own origin (e.g.
//    another GitHub Pages project under the same account). No CORS concerns;
//    not browser-isolated from the host.
//  - True cross-origin remote — a different domain. Browser-isolated from the
//    host. The module still loads its own ES module graph fine (same-origin
//    to itself) given the `allow-same-origin` sandbox token, and the adapter
//    handshake works cross-origin: the host passes its origin to the module
//    via the `hostOrigin` URL param so the module can target postMessage back
//    at the host. Verified end-to-end 2026-05-20.

export const knownIframePages = [
    {
        name: "Iframe Base",
        url: "./modules/iframe-base/index.html",
        description: "Basic iframe module showing connection status and heartbeat",
        shortName: "iframebase"
    },
    {
        name: "A-Mazing-Idle",
        url: "./modules/a-mazing-idle-remote/index-iframe.html",
        description: "Incremental maze game with bot automation",
        shortName: "mazegame"
    },
    {
        name: "Journey to Ascension",
        url: "./modules/jta-remote/index-iframe.html",
        description: "Incremental RPG adventure game",
        shortName: "jta"
    }
];

/**
 * Resolve an iframe URL from a shortname or pass through a full URL.
 * @param {string} input - A shortname (e.g., "mazegame") or a URL
 * @returns {string|null} The resolved URL, or null if input is empty
 */
export function resolveIframeUrl(input) {
    if (!input) return null;

    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if input matches a known shortname (case-insensitive)
    const lowerInput = trimmed.toLowerCase();
    const match = knownIframePages.find(page => page.shortName === lowerInput);
    if (match) {
        return match.url;
    }

    // Otherwise treat as a URL passthrough
    return trimmed;
}

/**
 * Whether an input refers to a known iframe page — either by shortname
 * (case-insensitive) or by an exact match of a known page URL. Used to
 * decide whether a custom-URL risk warning is needed before loading.
 * @param {string} input - A shortname or URL
 * @returns {boolean}
 */
export function isKnownIframePage(input) {
    if (!input) return false;
    const trimmed = input.trim();
    if (!trimmed) return false;
    const lowerInput = trimmed.toLowerCase();
    return knownIframePages.some(
        page => page.shortName === lowerInput || page.url === trimmed
    );
}
