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
 *                the entrance. A landing on a teleport-to-start host emits
 *                the same event tagged `teleport:true` (the braid's top-row
 *                return + the Regime-2 escape hatch), so fallBehavior is
 *                honored identically.
 *  - 'lockedPortal' / 'lockedPickup' — landed on a goal whose gate
 *                state is closed (rule-gated portals/pickups: the host
 *                bridge evaluates authored access rules and pushes
 *                per-goal booleans via setGateStates). Locked goals
 *                don't trigger — a locked portal doesn't teleport (and
 *                doesn't enter the once-per-session exit dedupe), a
 *                locked pickup doesn't collect; both fire again on a
 *                later landing once the gate opens. Fired per landing
 *                so the page can show the locked message.
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
    // Gate states for rule-gated portals/pickups: id -> boolean
    // (true = open). Ids absent from the maps are OPEN — only goals
    // the host's gate_rules mention can lock.
    let gateStates = { portals: {}, pickups: {} };
    const isOpen = (kind, id) => gateStates[kind][id] !== false;
    const collected = new Set();
    const exitedPortals = new Set();

    // Teleport-to-start hosts: landing on one returns the player to the
    // entrance (the Regime-2 escape hatch, and the braid's top-row return — it
    // REPLACED the old over-the-top wraparound). Same respawn path as a fall
    // off the bottom, so it honors fallBehavior exactly.
    const teleportHosts = new Set((level.teleports ?? []).map((t) => t.on));

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
                // Teleport-to-start: landing sends the player home. Emits the
                // SAME 'fell' event as a bottom fall (main.js handles
                // fallBehavior), tagged so the page can show a distinct
                // message. No goals trigger on a teleport host.
                if (teleportHosts.has(state.landedOn)) {
                    events.push({ type: 'fell', teleport: true });
                    state = spawnState(level, C);
                    return events;
                }
                for (const pk of level.pickups ?? []) {
                    if (pk.on !== state.landedOn || collected.has(pk.id)) continue;
                    if (!isOpen('pickups', pk.id)) {
                        events.push({ type: 'lockedPickup', id: pk.id });
                        continue;
                    }
                    collected.add(pk.id);
                    events.push({ type: 'pickup', id: pk.id });
                }
                for (const pt of level.portals ?? []) {
                    if (pt.on !== state.landedOn || exitedPortals.has(pt.id)) continue;
                    if (!isOpen('portals', pt.id)) {
                        events.push({ type: 'lockedPortal', portalId: pt.id });
                        continue;
                    }
                    exitedPortals.add(pt.id);
                    events.push({
                        type: 'exit',
                        portalId: pt.id,
                        direction: pt.direction ?? null,
                    });
                }
            }
            return events;
        },
    };
}
