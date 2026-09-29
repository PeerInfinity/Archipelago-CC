/**
 * procgenCore/locationCapacity — **HOW MANY LOCATIONS A SUBSTRATE'S ROOM HOLDS
 * AT A SIZE, AND THE SIZE A ROOM OF N LOCATIONS NEEDS** (APWORLD SUBSTRATE
 * CHANGE C2; ⚖ the user, 2026-09-28: *"YES to the location CAPACITY change
 * (C2, as a size hint)"*).
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * A procedural realiser (`generateRegionProcedural`) builds a room at the size
 * it is handed, and when the room cannot hold every location it re-rolls the
 * layout four times and then grows it by `REGION_GROW_STEP` per attempt. A
 * 340-location room was built NINE times to reach 27×27 (plan §41.4 #3), and
 * nothing before the build could say what size it would end at. A substrate
 * that DECLARES its capacity lets the realiser size the room once and the
 * Initialise form say *"Ingame: 340 locations → 27×27"* before anything runs.
 *
 * ── THE DECLARATION (on a registry entry, beside `sidecarFields`) ─────
 *
 *   locationCapacity: { kind: 'unbounded' }
 *       a room holds any number of locations at any size (a SIDES room — the
 *       text adventure lists its locations; it has no floor to run out of).
 *
 *   locationCapacity: { kind: 'tiles', capacityAt(size, params, demand) }
 *       `capacityAt` → `{ locations, gated }` — how many locations a room of
 *       `size` holds, and how many of them may carry a blocking rule — or
 *       `null` where the substrate cannot say (a walled layout: its floor is a
 *       draw, not a function of the size). `demand` carries the room's
 *       `exits` (and `biome`), which take floor of their own.
 *
 * ⛔ NO LITERAL TABLE. A capacity is a FUNCTION the substrate owns, held to its
 * realiser by a row that builds rooms (`locationCapacity.test.js`, and the
 * slow census row over the committed slots). An entry with no declaration
 * answers `null` everywhere here, and every caller keeps its pre-C2 behaviour.
 *
 * ⛔ A HINT, NOT A REFUSAL (the ruling). Nothing in this module refuses a room:
 * a room above its capacity still builds — it grows.
 *
 * ⛔ PURE AND BROWSER-SAFE: every function takes an ENTRY (or `null`); no
 * registry import, no substrate name.
 */

import { REGION_GROW_STEP } from '../shared/procgen/spatialPrimitives.js';

/** ⛓ The declaration kinds, as data. */
export const LOCATION_CAPACITY_KINDS = Object.freeze({ TILES: 'tiles', UNBOUNDED: 'unbounded' });

/** ⛓ The `True_` rule — a location that carries it blocks nothing. */
const isTrueRule = (rule) => rule?.rule === 'True_';

/**
 * ⛓⛓ **WHAT A ROOM ASKS OF ITS SUBSTRATE** — from a realiser spec's `locations`
 * and `exits` (the shape `generateRegion(spec)` takes). ONE function for the
 * realiser and the form, so the size the form prints is computed from the
 * numbers the realiser then sizes by:
 *   `locations` — the locations that TAKE A TILE: one carrying an item (the
 *                 placer sets the item on its tile, and no later pick lands
 *                 there) or a rule that is not `True_` (its gate stands on the
 *                 tile). ⛔ An item-less `True_` location places NOTHING on its
 *                 tile, so the next pick may land on the same one — it takes no
 *                 floor, and counting it would size a room for tiles nobody
 *                 uses (measured at C2: a 3×3 room "held" 10 of them);
 *   `gated`     — those whose rule is not `True_` (a gate takes the tile out of
 *                 the walkable floor);
 *   `exits`     — the room's exits (each takes a perimeter tile).
 */
export function locationDemandOf({ locations = [], exits = [] } = {}) {
    const seen = new Set();
    let tiled = 0;
    let gated = 0;
    for (const loc of locations) {
        if (seen.has(loc?.id)) continue;
        seen.add(loc?.id);
        const isGated = !!loc?.access_rule && !isTrueRule(loc.access_rule);
        if (isGated) gated += 1;
        if (isGated || loc?.item != null) tiled += 1;
    }
    return { locations: tiled, gated, exits: exits.length };
}

/** ⛓ The entry's declaration kind, or `null` when it declares none. */
export function locationCapacityKind(entry) {
    const kind = entry?.locationCapacity?.kind;
    return Object.values(LOCATION_CAPACITY_KINDS).includes(kind) ? kind : null;
}

/**
 * ⛓ **DOES A ROOM OF `size` HOLD `demand`?** `true`/`false`, or `null` where
 * the entry declares nothing or its `capacityAt` cannot answer for `params`.
 */
export function roomHolds(entry, size, params, demand) {
    const kind = locationCapacityKind(entry);
    if (kind === LOCATION_CAPACITY_KINDS.UNBOUNDED) return true;
    if (kind !== LOCATION_CAPACITY_KINDS.TILES) return null;
    const cap = entry.locationCapacity.capacityAt(size, params ?? {}, demand);
    if (!cap) return null;
    return demand.locations <= cap.locations && demand.gated <= cap.gated;
}

/**
 * ⛓⛓ **THE SIZE A ROOM OF `demand` NEEDS**, on the realiser's own grow ladder
 * (`start`, then `+REGION_GROW_STEP` on both axes per step): the first size
 * that holds it. `start` when it already does (or the kind is unbounded);
 * `null` where the entry cannot answer.
 * @returns {{width: number, height: number, steps: number}|null}
 */
export function sizeForLocations(entry, start, params, demand) {
    let size = { width: start.width, height: start.height };
    let last = null;
    for (let steps = 0; ; steps += 1) {
        const holds = roomHolds(entry, size, params, demand);
        if (holds === null) return null;
        if (holds) return { ...size, steps };
        // ⛔ a capacity that does not grow with the room never will — refuse
        // to loop rather than answer a size nothing can reach.
        const cap = entry.locationCapacity.capacityAt(size, params ?? {}, demand);
        if (last && cap.locations <= last.locations && cap.gated <= last.gated) return null;
        last = cap;
        size = { width: size.width + REGION_GROW_STEP, height: size.height + REGION_GROW_STEP };
    }
}

/** ⛓ The ids of the entries whose rooms hold any number of locations, in the order given. */
export function unboundedCapacityIds(entries) {
    return entries.filter((e) => locationCapacityKind(e) === LOCATION_CAPACITY_KINDS.UNBOUNDED).map((e) => e.id);
}
