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

    // The region's TOP row = the platforms with the smallest y. Landing on a
    // top-row platform WITHOUT exiting (the braid always leaves a portal-free
    // branch up there, and a locked portal doesn't teleport) arms the
    // over-the-top return: the next rise above the row loops the player to the
    // entrance. No portal-lock check is needed — the guaranteed portal-free
    // top branch is the over-the-top path.
    const platformById = new Map((level.platforms ?? []).map((p) => [p.id, p]));
    let topY = Infinity;
    for (const p of level.platforms ?? []) if (p.y < topY) topY = p.y;
    let overTopArmed = false;

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
            overTopArmed = false;
        },

        /** Advance one frame; returns the frame's events. */
        tick(input) {
            const events = [];
            state = step(state, input, level, abilities, C);
            if (state.fallen) {
                events.push({ type: 'fell' });
                state = spawnState(level, C);
                overTopArmed = false;
                return events;
            }
            // Over-the-top return: once the player has landed on the top row,
            // rising back above it loops them to the entrance — the SAME 'fell'
            // path as dropping off the bottom, so it honors fallBehavior.
            // (Armed only AFTER a top-row landing, so the climb UP to it —
            // which passes above the line on the way to the apex — doesn't
            // trigger.)
            if (overTopArmed && state.y < topY) {
                events.push({ type: 'fell', overTop: true });
                state = spawnState(level, C);
                overTopArmed = false;
                return events;
            }
            if (state.landedOn) {
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
                // Arm the over-the-top return iff this landing is on the top
                // row AND didn't exit a portal (open top portal = leave the
                // region, no loop); any other landing disarms it.
                const landedY = platformById.get(state.landedOn)?.y;
                const exitedThisLanding = events.some((e) => e.type === 'exit');
                overTopArmed = landedY !== undefined && landedY <= topY && !exitedThisLanding;
            }
            return events;
        },
    };
}
