/**
 * Custom-data URL resolution. Decides WHICH prose document to fetch for the
 * currently-loaded rules.json; fetching and caching stay in index.js.
 *
 * Split out of index.js (2026-07-26) so these stay unit-testable: index.js
 * imports the panel, the discovery singleton and settingsManager at module
 * scope, so testing three pure string functions through it would mean standing
 * up half the app. The deprecated textAdventureSubstrate kept the same split
 * for the same reason (textAdventureSubstrateStandalone.js).
 *
 * Resolution order (mirrors the deprecated module, so a user's existing
 * `autoLoadCustomData` setting keeps working unchanged):
 *   1. an explicit setting — a bare name maps to the conventional path,
 *      anything with a slash or a protocol is taken as a literal URL;
 *   2. otherwise the rules.json's game name, lowercased, in the conventional
 *      path;
 *   3. otherwise null, and the engine keeps its generic prose.
 */

const CUSTOM_DATA_DIR = './modules/shared/customData';

/** `<dir>/<game>_textadventure.json`, or null when there is no usable name. */
export function customDataUrlForGame(gameName) {
    if (!gameName || typeof gameName !== 'string') return null;
    const slug = gameName.trim().toLowerCase();
    if (!slug) return null;
    return `${CUSTOM_DATA_DIR}/${slug}_textadventure.json`;
}

/**
 * A setting value to a fetch URL. Bare names go through the conventional
 * path; anything containing a slash or a `protocol:` prefix is passed through
 * untouched so users can point at an arbitrary document.
 */
export function resolveCustomDataUrl(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.includes('/') || /^[a-z]+:/i.test(trimmed)) return trimmed;
    return customDataUrlForGame(trimmed);
}

/** The explicit setting if there is one, else auto-detect from the game name. */
export function pickAutoLoadCustomDataUrl(rulesJson, playerId, settingValue) {
    const explicit = resolveCustomDataUrl(settingValue);
    if (explicit) return explicit;
    const gameName = rulesJson?.world?.[playerId]?.game;
    return customDataUrlForGame(gameName);
}
