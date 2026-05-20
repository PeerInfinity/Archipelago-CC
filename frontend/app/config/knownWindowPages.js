// Shared known window pages configuration
// Used by windowManagerPanel UI and URL parameter handling
//
// Registering an external-URL (remote) module
// -------------------------------------------
// Each entry's `url` may be a relative path (same-origin) OR an absolute URL
// to a remote module. To register a remote module, add an entry with an
// absolute `url`, e.g.:
//
//   { name: "Example Remote", url: "https://example.github.io/my-module/index-iframe.html",
//     description: "...", shortName: "exampleremote" }
//
// A registered entry loads without the custom-URL risk warning; ad-hoc URLs
// typed into the Window Manager are treated as custom and warn first.
//
// NOTE: unlike the iframe variant, a separate window cannot be sandboxed at
// all (see CC/docs/plans/partial/external-iframe-modules.md, Phase 1). The
// adapter handshake still works cross-origin — the host passes its origin via
// the `hostOrigin` URL param so the module can target postMessage back at the
// host — but a same-origin remote window has full host access via
// `window.opener`. Prefer the iframe variant for untrusted-ish remotes.

export const knownWindowPages = [
    {
        name: "Window Base",
        url: "./modules/window-base/index.html",
        description: "Basic window module showing connection status and heartbeat",
        shortName: "windowbase"
    },
    {
        name: "A-Mazing-Idle",
        url: "./modules/a-mazing-idle-remote/index-iframe.html",
        description: "Incremental maze game in separate window",
        shortName: "mazegame"
    },
    {
        name: "Journey to Ascension",
        url: "./modules/jta-remote/index-iframe.html",
        description: "Incremental RPG adventure in separate window",
        shortName: "jta"
    }
];

/**
 * Resolve a window URL from a shortname or pass through a full URL.
 * @param {string} input - A shortname (e.g., "mazegame") or a URL
 * @returns {string|null} The resolved URL, or null if input is empty
 */
export function resolveWindowUrl(input) {
    if (!input) return null;

    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if input matches a known shortname (case-insensitive)
    const lowerInput = trimmed.toLowerCase();
    const match = knownWindowPages.find(page => page.shortName === lowerInput);
    if (match) {
        return match.url;
    }

    // Otherwise treat as a URL passthrough
    return trimmed;
}

/**
 * Whether an input refers to a known window page — either by shortname
 * (case-insensitive) or by an exact match of a known page URL. Used to
 * decide whether a custom-URL risk warning is needed before loading.
 * @param {string} input - A shortname or URL
 * @returns {boolean}
 */
export function isKnownWindowPage(input) {
    if (!input) return false;
    const trimmed = input.trim();
    if (!trimmed) return false;
    const lowerInput = trimmed.toLowerCase();
    return knownWindowPages.some(
        page => page.shortName === lowerInput || page.url === trimmed
    );
}
