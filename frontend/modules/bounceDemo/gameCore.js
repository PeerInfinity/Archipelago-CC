/**
 * Bounce Demo game session — build-order step 6
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md). The
 * bridge-agnostic runtime state machine the renderer page wraps:
 * holds the player state, applies AP items as abilities, and turns
 * landings into pickup/exit events. No DOM, no bridge — unit-testable,
 * and the same `step`/suppression modules the build-time solver uses,
 * so derived rules and runtime behavior cannot drift.
 *
 * Item application is structurally per-frame: `step` consults the
 * current ability set every frame, so granting an item mid-flight
 * un-suppresses platforms on the very next frame (the probe's
 * "per-frame re-assert" requirement, satisfied by construction).
 *
 * Event semantics:
 *  - 'pickup'  — first landing on a pickup's host platform. Collected
 *                set persists across falls (AP checks don't un-check).
 *  - 'exit'    — first landing on a portal's host platform (once per
 *                portal per session; in the embedded game the host
 *                unloads the region on the first one anyway).
 *  - 'fell'    — fell out of the level; the session auto-respawns at
 *                the entrance.
 */

import { DEFAULTS, step, spawnState } from './physics.js';
import { ABILITY_ITEM_NAMES } from './apRules.js';
import { noAbilities } from './suppression.js';

const ITEM_ABILITIES = Object.fromEntries(
    Object.entries(ABILITY_ITEM_NAMES).map(([ability, item]) => [item, ability]));

/** Map AP item names (strings or {name} objects) to an ability set. */
export function itemsToAbilities(itemNames) {
    const abilities = noAbilities();
    for (const raw of itemNames ?? []) {
        const name = typeof raw === 'string' ? raw : raw?.name;
        const ability = ITEM_ABILITIES[name];
        if (ability) abilities[ability] = true;
    }
    return abilities;
}

export function createGameSession(level, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    let state = spawnState(level, C);
    let abilities = noAbilities();
    const collected = new Set();
    const exitedPortals = new Set();

    return {
        level,
        get state() { return state; },
        get abilities() { return abilities; },
        get collected() { return collected; },

        setItems(itemNames) {
            abilities = itemsToAbilities(itemNames);
        },

        /**
         * Seed already-collected pickups from host AP state. A region
         * revisit creates a FRESH session; without this the level
         * re-offers checked pickups and re-landing re-fires 'pickup'
         * (the host then warns the location was already checked).
         */
        seedCollected(pickupIds) {
            for (const id of pickupIds ?? []) collected.add(id);
        },

        /** Back to the entrance. Collected pickups persist (AP state). */
        reset() {
            state = spawnState(level, C);
            exitedPortals.clear();
        },

        /** Advance one frame; returns the frame's events. */
        tick(input) {
            const events = [];
            state = step(state, input, level, abilities, C);
            if (state.fallen) {
                events.push({ type: 'fell' });
                state = spawnState(level, C);
                return events;
            }
            if (state.landedOn) {
                for (const pk of level.pickups ?? []) {
                    if (pk.on === state.landedOn && !collected.has(pk.id)) {
                        collected.add(pk.id);
                        events.push({ type: 'pickup', id: pk.id });
                    }
                }
                for (const pt of level.portals ?? []) {
                    if (pt.on === state.landedOn && !exitedPortals.has(pt.id)) {
                        exitedPortals.add(pt.id);
                        events.push({
                            type: 'exit',
                            portalId: pt.id,
                            direction: pt.direction ?? null,
                        });
                    }
                }
            }
            return events;
        },
    };
}
