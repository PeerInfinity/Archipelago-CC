/**
 * Bounce Demo bot driver — the playback bot's game-side input
 * synthesizer (sphere-driven-growth priority #4). Greedy re-plan
 * controller: on every landing it recomputes the shortest jump path
 * from the current platform to the target goal's host platform over
 * the canJump platform graph, then picks an input policy by forward-
 * simulating candidates from the LIVE state through the real engine
 * (the same `step` the game runs — driver and game cannot disagree by
 * construction). No stored plan: divergence (missed drift, re-landing,
 * mid-flight item grant) just means the next landing re-plans from
 * wherever the player actually is.
 *
 * The driver is Archipelago-naive: targets arrive as game-local goal
 * ids ({ kind: 'pickup' | 'portal', id }) — the host bridge translates
 * AP location / exit names before calling in. It emits per-frame
 * inputs only; collection/exit semantics stay in gameCore (a locked
 * target portal needs no special handling — the driver parks the
 * player on its host platform, every landing re-fires, and the portal
 * arms once the host pushes fresh gate states).
 *
 * On-column legs naturally synthesize NO input (policy 'none' is the
 * cheapest candidate), so the observed auto-play of sphere worlds is
 * the degenerate case of this driver, not a separate mode.
 *
 * Bounce physics cannot descend a column (every launch lands you back
 * on the same platform or higher), so a target BELOW the player can
 * be jump-unreachable from the current platform while perfectly
 * reachable from the entrance — branch tips attach to specific column
 * rungs, and the auto-climb routinely overshoots them. The driver's
 * answer is the DESCEND fallback: when no jump path exists from here
 * but one exists from the entrance, hold a drift direction to fall
 * off the level; the engine respawns at the entrance (real game
 * physics, fallBehavior 'current') and the next plan starts from the
 * verified low route. Any accidental landing on the way down just
 * re-plans — greedy re-plan makes the fall safe.
 */

import { DEFAULTS, step as physicsStep } from './physics.js';
import { ENTRANCE, buildPlatformGraph, policiesFor } from './canJump.js';

const SIM_MAX_FRAMES = 600;

/**
 * BFS shortest path over a platform graph's adjacency map, optionally
 * refusing to pass THROUGH blocked nodes (the goal node is always
 * allowed — `blocked` guards intermediate hops only). Returns
 * [from, ..., to] or null. Exported for testing.
 */
export function shortestPath(graph, fromId, toId, blocked = new Set()) {
    if (fromId === toId) return [fromId];
    const prev = new Map([[fromId, null]]);
    const queue = [fromId];
    while (queue.length > 0) {
        const node = queue.shift();
        for (const next of graph.edges.get(node) ?? []) {
            if (prev.has(next)) continue;
            if (next !== toId && blocked.has(next)) continue;
            prev.set(next, node);
            if (next === toId) {
                const path = [toId];
                let p = node;
                while (p !== null) { path.unshift(p); p = prev.get(p); }
                return path;
            }
            queue.push(next);
        }
    }
    return null;
}

function platformById(level, id) {
    return level.platforms.find((p) => p.id === id) ?? null;
}

/** Host platform id for a goal, or null when the goal isn't in this level. */
function resolveGoalHost(level, target) {
    if (!target) return null;
    const pool = target.kind === 'pickup' ? level.pickups : level.portals;
    return (pool ?? []).find((g) => g.id === target.id)?.on ?? null;
}

/** Stable cache key for the ability set (graph reuse across landings). */
function abilitiesKey(abilities) {
    return Object.keys(abilities).filter((k) => abilities[k]).sort().join(',');
}

/**
 * Forward-simulate one policy from the live state until the player
 * lands on a platform other than `fromId` (re-landing on the launch
 * platform re-launches, as in jumpQuery), falls, or times out.
 * Returns the landing platform id or null.
 */
function simulatePolicy(level, startState, abilities, policyFn, fromId, C) {
    let state = startState;
    for (let frame = 1; frame <= SIM_MAX_FRAMES; frame++) {
        state = physicsStep(state, policyFn(state, frame), level, abilities, C);
        if (state.fallen) return null;
        if (state.landedOn && state.landedOn !== fromId) return state.landedOn;
    }
    return null;
}

/**
 * @param {object} [opts]
 * @param {object} [opts.constants] physics constants (DEFAULTS)
 * @returns bot driver. Per-frame contract: the game loop calls
 *   `nextInput(state, level, abilities, { isPortalOpen })` BEFORE
 *   session.tick and feeds the returned input to that tick. `state`
 *   is therefore the PREVIOUS tick's output — a landing is observed
 *   exactly once (`state.landedOn` is only set on landing frames),
 *   which is the driver's re-plan trigger.
 */
export function createBotDriver(opts = {}) {
    const C = opts.constants ?? DEFAULTS;

    let target = null;          // { kind: 'pickup' | 'portal', id }
    let lastPlatform = ENTRANCE;
    let policyFn = null;        // active policy until the next landing
    let policyFrame = 0;
    let policyName = null;
    let nextPlatform = null;    // the leg's destination (status surface)
    let stuck = false;          // no path / no witness at last re-plan
    let graph = null;           // cached canJump graph
    let graphKey = null;        // level.id + abilities signature

    function ensureGraph(level, abilities) {
        const key = `${level.id}|${abilitiesKey(abilities)}`;
        if (graphKey !== key) {
            graph = buildPlatformGraph(level, abilities, { constants: C });
            graphKey = key;
        }
        return graph;
    }

    /**
     * Re-plan from `lastPlatform`: shortest path to the goal host
     * (avoiding hosts of OPEN non-target portals — landing on one
     * would exit the region mid-route; falling back to an unfiltered
     * path when avoidance walls the goal off), then pick the first
     * candidate policy that the live-state simulation confirms
     * reaches the leg's platform.
     */
    function replan(state, level, abilities, helpers) {
        policyFn = null;
        policyFrame = 0;
        policyName = null;
        nextPlatform = null;
        stuck = false;

        const goalHost = resolveGoalHost(level, target);
        if (!goalHost) return;              // not this region's goal — wait
        if (lastPlatform === goalHost) return; // arrived: bounce in place

        const g = ensureGraph(level, abilities);
        const isPortalOpen = helpers?.isPortalOpen ?? (() => true);
        const blocked = new Set(
            (level.portals ?? [])
                .filter((pt) => pt.id !== target?.id && isPortalOpen(pt.id))
                .map((pt) => pt.on));
        const path = shortestPath(g, lastPlatform, goalHost, blocked)
            ?? shortestPath(g, lastPlatform, goalHost);
        if (!path || path.length < 2) {
            // No jump route from here. If the entrance can reach the
            // goal and we can steer, deliberately fall off the level —
            // the respawn IS the route down (see header). Without
            // arrows we can't leave the column, so park and wait
            // (items may still arrive and change the graph).
            const fromEntrance = shortestPath(g, ENTRANCE, goalHost, blocked)
                ?? shortestPath(g, ENTRANCE, goalHost);
            if (fromEntrance && lastPlatform !== ENTRANCE
                    && (abilities.left || abilities.right)) {
                const dir = abilities.right ? { right: true } : { left: true };
                policyFn = () => dir;
                policyName = 'descend';
                return;
            }
            stuck = true;                   // retry at the next landing
            return;
        }
        const legTo = path[1];
        const legPlatform = platformById(level, legTo);
        if (!legPlatform) { stuck = true; return; }

        const candidates = policiesFor(legPlatform.x, abilities);
        for (const candidate of candidates) {
            if (simulatePolicy(level, state, abilities, candidate.fn, lastPlatform, C) === legTo) {
                policyFn = candidate.fn;
                policyName = candidate.name;
                nextPlatform = legTo;
                return;
            }
        }
        // The edge exists (canJump witnessed it from sampled launch
        // positions) but no candidate validates from THIS exact x.
        // Parking would re-land here at the same x forever; running
        // the unvalidated seek at least perturbs the state — wherever
        // we end up (the leg platform, elsewhere, or a fall-respawn),
        // the next landing re-plans.
        const seek = candidates.find((c) => c.name === 'seek');
        if (seek) {
            policyFn = seek.fn;
            policyName = 'seek-forced';
            nextPlatform = legTo;
            return;
        }
        stuck = true;                       // no arrows — cannot steer
    }

    return {
        setTarget(goal) {
            target = goal ?? null;
            policyFn = null;
            // Plan eagerly on the next nextInput call (treat it like a
            // landing) so entrance steering starts from the first frame.
            policyFrame = -1;
        },

        clearTarget() {
            target = null;
            policyFn = null;
            policyName = null;
            nextPlatform = null;
            stuck = false;
        },

        /** The player fell and respawned at the entrance. */
        notifyFell() {
            lastPlatform = ENTRANCE;
            policyFn = null;
            policyFrame = -1;               // re-plan on the next frame
        },

        getStatus() {
            return {
                active: target !== null,
                target,
                lastPlatform,
                nextPlatform,
                policy: policyName,
                stuck,
            };
        },

        /**
         * Per-frame input for the game loop. Null when idle, when the
         * target isn't resolvable in this level, or when the active
         * policy says "no input this frame".
         */
        nextInput(state, level, abilities, helpers = {}) {
            // Track landings even while idle: auto-play moves the
            // player long before the first walkTo arrives, and a plan
            // made from a stale platform aims at the wrong leg.
            if (state?.landedOn) lastPlatform = state.landedOn;
            if (!target || !level) return null;
            if (state.landedOn) {
                replan(state, level, abilities, helpers);
            } else if (policyFrame === -1) {
                replan(state, level, abilities, helpers);
            }
            if (!policyFn) { policyFrame = Math.max(policyFrame, 0); return null; }
            policyFrame += 1;
            return policyFn(state, policyFrame);
        },
    };
}
