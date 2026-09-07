/**
 * menuPanelEngine.js — the pure half of the menu panel.
 *
 * Everything the panel SHOWS is derived here from the loaded rules.json
 * document plus the player's current region. No DOM, no eventBus, no
 * settingsManager: this file is what the vitest rows drive.
 *
 * ⛔ NOTHING HERE KNOWS THE NAME "Menu". The AP-declared start region is
 * whatever `start_regions[<player>].default` names — 212 committed presets
 * happen to call it Menu, but alttp's three Save-and-Quit warps are that
 * region's three EXITS, and a world is free to call it anything. The panel's
 * whole "am I at the menu?" question is `startRegions.includes(currentRegion)`,
 * which at runtime is `gameState.isStartRegion`.
 *
 * `start_regions` is read through `procgenCore/rulesGraph.startRegionsOf` —
 * the ONE reader for both committed shapes (see that module's header).
 */

import { startRegionsOf, regionsOf, DEFAULT_PLAYER_ID } from '../procgenCore/rulesGraph.js';

/** Module id / GoldenLayout componentType. Both configs and the tests key on these. */
export const MENU_PANEL_MODULE_ID = 'menuPanel';
export const MENU_PANEL_COMPONENT_TYPE = 'menuPanel';

/** The "skip the menu" setting: key, full settingsManager path, schema default. */
export const SKIP_MENU_SETTING_KEY = 'skipMenu';
export const SKIP_MENU_SETTING_PATH = `moduleSettings.${MENU_PANEL_MODULE_ID}.${SKIP_MENU_SETTING_KEY}`;
export const SKIP_MENU_DEFAULT = true;

/**
 * `source` tags on the moves this module publishes. All three start with the
 * module id, which is what `isLoopModePlanningSource` matches on — pressing an
 * exit is AUTHORING (like a region-graph click), not performed play.
 */
export const MOVE_SOURCE_EXIT = `${MENU_PANEL_MODULE_ID}-exit`;
export const MOVE_SOURCE_START = `${MENU_PANEL_MODULE_ID}-start`;
export const MOVE_SOURCE_RESTART = `${MENU_PANEL_MODULE_ID}-restart`;

/**
 * One exit of a start region, as a button's worth of data.
 * @typedef {{name: string|null, targetRegion: string}} MenuExit
 */

/**
 * Every exit of `regionName` that names a destination, in document order.
 * An exit with no `connected_region` is dropped — there is nothing to move to.
 *
 * @param {object} doc a rules.json document
 * @param {string} playerId
 * @param {string|null} regionName
 * @returns {MenuExit[]}
 */
export function exitsOf(doc, playerId = DEFAULT_PLAYER_ID, regionName = null) {
    if (!regionName) return [];
    const region = regionsOf(doc, playerId)[regionName];
    const exits = Array.isArray(region?.exits) ? region.exits : [];
    return exits
        .filter((e) => typeof e?.connected_region === 'string' && e.connected_region)
        .map((e) => ({
            name: typeof e.name === 'string' && e.name ? e.name : null,
            targetRegion: e.connected_region,
        }));
}

/**
 * The exit the "skip the menu" hop takes: the FIRST exit of the start region.
 * Null when the region has none (a world with a dead-end start — the panel then
 * shows no buttons and nothing hops, which is the honest outcome).
 *
 * @returns {MenuExit|null}
 */
export function firstExitOf(doc, playerId = DEFAULT_PLAYER_ID, regionName = null) {
    return exitsOf(doc, playerId, regionName)[0] ?? null;
}

/**
 * Everything the panel renders, derived from the document and the player's
 * position. The caller supplies `currentRegion` (gameState's), never the
 * document — the document has no notion of where the player is.
 *
 * `atStartRegion` is the panel's whole state machine: true ⇒ show the exit
 * buttons; false ⇒ the player is out in the world and only Restart applies.
 *
 * @param {object} doc a rules.json document
 * @param {string} playerId
 * @param {string|null} currentRegion
 * @returns {{gameName: string|null, seedName: string|null, startRegions: string[],
 *            currentRegion: string|null, atStartRegion: boolean, exits: MenuExit[]}}
 */
export function describeMenu(doc, playerId = DEFAULT_PLAYER_ID, currentRegion = null) {
    const startRegions = [...startRegionsOf(doc, playerId).default];
    const atStartRegion = currentRegion != null && startRegions.includes(currentRegion);
    return {
        gameName: typeof doc?.game_name === 'string' ? doc.game_name : null,
        seedName: doc?.seed_name != null ? String(doc.seed_name) : null,
        startRegions,
        currentRegion,
        atStartRegion,
        // Exits of the region the player is standing in, and only when that
        // region is a start region: an exit button here is "leave the menu",
        // not a general movement UI (the Regions/Exits panels are that).
        exits: atStartRegion ? exitsOf(doc, playerId, currentRegion) : [],
    };
}

/**
 * Which start region a Restart returns to when the substrate coordinator has
 * no opinion: the FIRST declared default. `resolvedStart` is
 * procgenPlayer.getResolvedStartRegion() — for a procgen world that is the
 * first WAREHOUSED region (the synthetic wrapper has no playable payload), and
 * null for every plain world.
 *
 * @param {string|null} resolvedStart
 * @param {string[]} startRegions gameState.startRegions
 * @returns {string|null}
 */
export function restartTargetOf(resolvedStart, startRegions = []) {
    if (resolvedStart) return resolvedStart;
    return startRegions[0] ?? null;
}

/**
 * Does the procgen coordinator own this world's start hop?
 *
 * ⛔ This is the "exactly one publisher per load" question, and the answer is
 * NOT "does the document carry preset_sidecars". `procgenPlayer` publishes its
 * hop only when `findStartRegion` resolved one, and it caches exactly that in
 * `getResolvedStartRegion()` — so a procgen document whose start resolves to
 * nothing leaves the hop to this panel, which is correct: otherwise nobody
 * would move and a skip-ON load would sit at the menu.
 *
 * @param {string|null} resolvedStart the value of procgenPlayer.getResolvedStartRegion()
 * @returns {boolean}
 */
export function procgenOwnsStartHop(resolvedStart) {
    return typeof resolvedStart === 'string' && resolvedStart.length > 0;
}
