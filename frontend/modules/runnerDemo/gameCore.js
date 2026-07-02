/**
 * Runner game session — the bridge-agnostic runtime state machine the
 * game page wraps (bounceDemo/gameCore.js is the model): holds the
 * player state, applies AP items as abilities, and turns goal TOUCHES
 * into pickup/exit events. No DOM, no bridge — unit-testable, and the
 * same `step`/suppression modules the build-time solver samples, so
 * derived rules and runtime behavior cannot drift.
 *
 * Runner-vs-bounce differences that shape the event logic:
 * - Goals are TOUCH-triggered (physics reports `touchedPickups` /
 *   `touchedPortals` per tick), not landing-triggered — events fire
 *   on the touch-ENTER edge (in the touched set this tick, not last),
 *   so an overlap held across ticks fires once.
 * - Respawns happen INSIDE step() (`state.respawned` = 'fell' |
 *   'hazard' | 'reset'); the session just reports them.
 *
 * Event semantics:
 *  - 'pickup'    — touch-enter on an uncollected pickup. Collected
 *                  set persists across respawns (AP checks don't
 *                  un-check).
 *  - 'exit'      — touch-enter on a portal (once per portal per
 *                  session; embedded, the host unloads the region on
 *                  the first one anyway).
 *  - 'respawned' — { cause: 'fell' | 'hazard' | 'reset' }; the player
 *                  is already back at the entrance.
 *  - 'lockedPickup' / 'lockedPortal' — touch-enter on a goal whose
 *                  host-evaluated gate state is closed. Locked goals
 *                  don't trigger; both fire again on a later
 *                  touch-enter once the gate opens.
 */

import { DEFAULTS, step, spawnState } from './physics.js';
import { noAbilities } from './suppression.js';

/**
 * Ability -> AP item names (plan §4.6). Defined here because the game
 * runtime maps received items back to abilities with the same table;
 * apRules.js (the rule emitter) imports and re-exports these — one
 * definition, two consumers.
 */
export const ABILITY_ITEM_NAMES = Object.freeze({
    doubleJump: 'Double Jump',
    blue: 'Blue Platforms',
});
export const VICTORY_ITEM_NAME = 'Victory';

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
    let prevTouchedPickups = new Set();
    let prevTouchedPortals = new Set();
    let abilities = noAbilities();
    // Gate states for rule-gated portals/pickups: id -> boolean
    // (true = open). Ids absent from the maps are OPEN — only goals
    // the host's gate_rules mention can lock.
    let gateStates = { portals: {}, pickups: {} };
    const isOpen = (kind, id) => gateStates[kind][id] !== false;
    const collected = new Set();
    const exitedPortals = new Set();
    const portalsById = new Map((level.portals ?? []).map((pt) => [pt.id, pt]));

    return {
        level,
        get state() { return state; },
        get abilities() { return abilities; },
        get collected() { return collected; },
        get gateStates() { return gateStates; },
        get constants() { return C; },

        setItems(itemNames) {
            abilities = itemsToAbilities(itemNames);
        },

        /** Host-evaluated lock booleans ({ portals, pickups }). */
        setGateStates(states) {
            gateStates = {
                portals: { ...(states?.portals ?? {}) },
                pickups: { ...(states?.pickups ?? {}) },
            };
        },

        /**
         * Seed already-collected pickups from host AP state. A region
         * revisit creates a FRESH session; without this the level
         * re-offers checked pickups and re-touching re-fires 'pickup'.
         */
        seedCollected(pickupIds) {
            for (const id of pickupIds ?? []) collected.add(id);
        },

        /** Back to the entrance. Collected pickups persist (AP state). */
        reset() {
            state = spawnState(level, C);
            prevTouchedPickups = new Set();
            prevTouchedPortals = new Set();
            exitedPortals.clear();
        },

        /** Advance one logical tick; returns the tick's events. */
        tick(input) {
            const events = [];
            state = step(state, input, level, abilities, C);
            if (state.respawned) {
                events.push({ type: 'respawned', cause: state.respawned });
                prevTouchedPickups = new Set();
                prevTouchedPortals = new Set();
                return events;
            }
            for (const id of state.touchedPickups) {
                if (prevTouchedPickups.has(id) || collected.has(id)) continue;
                if (!isOpen('pickups', id)) {
                    events.push({ type: 'lockedPickup', id });
                    continue;
                }
                collected.add(id);
                events.push({ type: 'pickup', id });
            }
            for (const id of state.touchedPortals) {
                if (prevTouchedPortals.has(id) || exitedPortals.has(id)) continue;
                if (!isOpen('portals', id)) {
                    events.push({ type: 'lockedPortal', portalId: id });
                    continue;
                }
                exitedPortals.add(id);
                events.push({
                    type: 'exit',
                    portalId: id,
                    arrow: portalsById.get(id)?.arrow ?? null,
                });
            }
            prevTouchedPickups = new Set(state.touchedPickups);
            prevTouchedPortals = new Set(state.touchedPortals);
            return events;
        },
    };
}
