/**
 * seedlingGenCapacity — **HOW MANY AP LOCATIONS A GENERATED SEEDLING ROOM
 * HOLDS** (SEEDLING GENERATED G9; the vocabulary is `procgenCore/locationCapacity.js`). The
 * `flash_seedling_gen` entry's `locationCapacity.capacityAt`.
 *
 * ⛔ LIGHT: the entry is in the flash panel's static closure, so this module
 * imports only `breakableRocks.js` (no import of its own) — never the
 * generator. The build half (`seedlingGenRoom.js`) reads its bounds from HERE,
 * so the declaration and the room cannot drift apart.
 *
 * ── TWO BOUNDS; THE CAPACITY IS THE SMALLER ───────────────────────────
 *
 *  · THE FLOOR — a location stands on a cell, and so does a door: the room's
 *    interior (its border is wall by construction) less the start holds
 *    `genRoomFloorCells(size)` of them (G8's `roomCanHold`, whose count this
 *    is). GROWTH LIFTS IT: the room grows 2 a side per spent re-roll budget.
 *    ⚠ A count bound, not a seat: a location also needs a SAFE reachable cell
 *    off every door and its neighbours, so a room at its floor can still
 *    re-roll or grow — the realiser's own loop, and the reason this is a HINT.
 *  · THE CEILING — every location's pickup takes one of the level's
 *    `TAGS_PER_LEVEL` (30, `Game.tagsPerLevel`, `Game.as:525`) persistence
 *    tags, and NO SIZE ADDS ANY. Location 0 takes the goal's own tag (the
 *    tags are allocated against the room WITHOUT its goal pickup), so the
 *    ceiling is 30, not 29.
 *
 * ── ⚖ THE CEILING IS THE CERTAIN BOUND, NOT THE WORST CASE (planner, G9) ──
 *
 * A room's own elements spend tags too (a guard 3, a kill gate / rock gate /
 * shield gate 1; `procgenSeedlingElements.js`), and the biome-default element
 * list (`elements: ''` → guard | killgate | blockpocket | chamber) reaches a
 * room with a guard in 1 of 60 pre-sword draws. A worst-case ceiling (27)
 * would refuse a 28–30-location slot that 59 draws in 60 seat — a wrong
 * number. Instead a draw whose elements leave too few tags is RE-ROLLED like
 * one with too few cells (`seedlingGenRoom.addLocations`), so the ceiling is
 * what EVERY draw leaves: 30 minus the tags every draw spends, which is 0 at
 * every knob this entry offers. ⚠ Except a `require` directive: every room
 * that meets it carries an element that needs the item — plan §16 Open.
 *
 * ⛓ `gated` = `locations`: a Seedling location's rule is LOGIC ONLY — it takes
 * no floor (the host enforces DOORS, not pickups), so every location the room
 * holds may carry one.
 */

import { TAGS_PER_LEVEL } from './breakableRocks.js';

/** ⛓ The most AP locations a generated room holds at any size: one persistence tag each. */
export const GEN_ROOM_LOCATION_CEILING = TAGS_PER_LEVEL;

/** ⛓ The ceiling's reason, in the words the Initialise form prints. */
export const GEN_ROOM_CEILING_WHY = `the game's ${TAGS_PER_LEVEL} persistence tags`;

/**
 * ⛓ The cells a room of `size` offers its doors and locations: the interior
 * (the border is wall) less the start. `seedlingGenRoom.roomCanHold` compares
 * against this.
 */
export function genRoomFloorCells(size) {
    return (size.width - 2) * (size.height - 2) - 1;
}

/**
 * `capacityAt(size, params, demand)` → `{locations, gated, ceiling}`.
 * `locations` counts the TILE-taking locations (`demand.locations`, the
 * vocabulary's unit); a listed location without a tile (`demand.listed`
 * beyond it) still takes a cell and a tag here, so it is taken off both.
 */
export function genRoomCapacityAt(size, _params = {}, demand = {}) {
    const tiled = demand.locations ?? 0;
    const untiled = Math.max(0, (demand.listed ?? tiled) - tiled);
    const floor = genRoomFloorCells(size) - (demand.exits ?? 0);
    const locations = Math.max(0, Math.min(floor, GEN_ROOM_LOCATION_CEILING) - untiled);
    return {
        locations,
        gated: locations,
        ceiling: { locations: GEN_ROOM_LOCATION_CEILING, why: GEN_ROOM_CEILING_WHY },
    };
}
