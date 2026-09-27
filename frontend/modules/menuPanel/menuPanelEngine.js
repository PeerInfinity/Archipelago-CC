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
 * The FIRST exit of the start region — the one the skip hop takes when
 * `skipsStart` says the start has exactly one. Null when the region has none.
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
 * Which region a Restart returns to: the FIRST DECLARED start, always.
 *
 * ⛓ APWORLD SUBSTRATE CHANGE M2 (⚖ user 2026-09-26, plan §25.7–§25.8):
 * *returning to the menu* IS Restart — it clears the path and returns to the
 * DECLARED start. Until M2 this preferred procgenPlayer's resolved start (the
 * first WAREHOUSED region), so in a procgen world Restart never reached the
 * menu: measured on mm3 initialised, Restart landed on the first placed stage
 * and the other 12 Menu exits were unreachable. The convention it embodies:
 * the declared start is always accessible.
 *
 * @param {string[]} startRegions gameState.startRegions
 * @returns {string|null}
 */
export function restartTargetOf(startRegions = []) {
    return startRegions[0] ?? null;
}

/**
 * ⛓⛓ **DOES THE LOAD SKIP THIS START REGION?** — the ONE rule both publishers
 * of the start hop read (this panel for a plain world, `procgenPlayer` for a
 * warehoused one, through the `menuPanel.skipsStart` public function): the
 * *Skip the menu* setting is on AND the start has EXACTLY ONE exit.
 *
 * ⛓ M2 (⚖ user 2026-09-26: *"skipping only when the menu has only one exit"*):
 * a start with several exits is a real choice — the hop used to take the FIRST
 * of them (mm3: the first of 13 stages) — so it is never skipped, whatever the
 * setting; the player stays at the start with the panel listing every exit. A
 * start with no exit has nothing to skip to.
 *
 * @param {object} doc a rules.json document
 * @param {string} playerId
 * @param {string|null} region the start region the player stands in
 * @param {boolean} skipEnabled the *Skip the menu* setting
 * @returns {boolean}
 */
export function skipsStart(doc, playerId = DEFAULT_PLAYER_ID, region = null, skipEnabled = SKIP_MENU_DEFAULT) {
    return skipEnabled === true && exitsOf(doc, playerId, region).length === 1;
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
