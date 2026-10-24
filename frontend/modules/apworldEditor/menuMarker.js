/**
 * apworldEditor/menuMarker — **THE MENU ON THE MAP, AS A MARKER** (APWORLD
 * SUBSTRATE CHANGE M2; plan §25.7–§25.8, ⚖ user 2026-09-26).
 *
 * The Menu is the layout's HUB (R8, shape A): every exit of the declared start
 * feeds a root, and the start itself stays VIRTUAL at runtime (the menu panel
 * implements it) — it has no cell, so the composite grid cannot draw it. The
 * Map draws it BESIDE the grid instead: the start's name and one entry per exit,
 * each naming its target and whether that target has a cell on this slot's grid.
 *
 * ⛓ A rendering choice, not a document fact: the marker is DERIVED at draw time
 * from `regions[p][<declared start>].exits` and the entries' `grid_cell`, and it
 * is shown or hidden by a MODULE SETTING (`showMenuOnMap`, default ON) — never a
 * document key.
 *
 * ⛔ No region name here. The subject is the DECLARED start
 * (`startRegionsOf(doc, p).default[0]`), whatever it is called (planner, M2: the
 * start region is the menu even when it is not named "Menu" — `apcalc`'s `C` is a
 * cell AND the menu). The exits are the menu panel's own (`exitsOf`), so the
 * marker lists exactly the buttons the panel draws.
 */

import { startRegionsOf } from '../procgenCore/rulesGraph.js';
import { exitsOf } from '../menuPanel/menuPanelEngine.js';

/** ⛓ The setting's key and full path (read by the panel at each Map draw). */
export const SHOW_MENU_ON_MAP_KEY = 'showMenuOnMap';
export const SHOW_MENU_ON_MAP_SETTING = `moduleSettings.apworldEditor.${SHOW_MENU_ON_MAP_KEY}`;

/** ⛓ ON (plan §25.7: in shape A it explains why the teleporter-fed roots exist). */
export const SHOW_MENU_ON_MAP_DEFAULT = true;

/** ⛓ The schema property `apworldEditor/index.js` registers beside R2's and R7's. */
export const SHOW_MENU_ON_MAP_SCHEMA = Object.freeze({
    type: 'boolean',
    default: SHOW_MENU_ON_MAP_DEFAULT,
    label: 'Show the Menu on the map',
    description: 'Whether the APWorld Editor\'s Map tab lists the declared start region (the Menu) beside the '
        + 'grid: one entry per exit, naming its target and whether that target has a cell. The Menu itself '
        + 'never has a cell — it is the hub every root is reached from.',
});

/** ⛓ What a stored value means: a boolean is itself; anything else is the default. */
export function showMenuOnMap(value) {
    return typeof value === 'boolean' ? value : SHOW_MENU_ON_MAP_DEFAULT;
}

/**
 * ⛓⛓ **THE MARKER'S CONTENT** — the declared start and its exits, each with its
 * target and whether the slot's sidecar entry for that target carries a
 * `grid_cell`.
 *
 * @returns {{name: string, exits: Array<{name: string|null, target: string, placed: boolean}>}|null}
 *   null when the slot declares no start, or its start has no exit.
 */
export function menuMarkerFor(doc, player) {
    const p = String(player);
    const [name = null] = startRegionsOf(doc, p).default;
    if (!name) return null;
    const exits = exitsOf(doc, p, name);
    if (exits.length === 0) return null;
    const entries = doc?.preset_sidecars?.[p];
    const hasCell = (t) => !!(entries && typeof entries === 'object' && entries[t]?.grid_cell);
    return {
        name,
        exits: exits.map((e) => ({ name: e.name, target: e.targetRegion, placed: hasCell(e.targetRegion) })),
    };
}
