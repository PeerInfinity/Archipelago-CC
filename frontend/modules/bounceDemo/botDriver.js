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
 * reachable from the entrance — the auto-climb routinely overshoots
 * branch tips. The driver recovers by returning to the entrance and
 * re-planning from the verified low route. Two ways home:
 *   - BRAIDS (and any teleport-equipped level): the platform graph gives
 *     each teleport-to-start host an edge back to ENTRANCE, so a normal
 *     shortest path threads `… → teleportHost → ENTRANCE → … → goal`. The
 *     bot just climbs to the teleport host; landing there sends it home
 *     (gameCore), and greedy re-plan takes the low route.
 *   - LEGACY COLUMNS (no teleport host): the DESCEND fallback — hold a
 *     drift direction to fall off the level; the engine respawns at the
 *     entrance. Gated on the absence of a teleport route, and removable
 *     once sphere growth emits braids instead of columns (Regime-2 step 6).
 */

import { DEFAULTS, step as physicsStep } from './physics.js';
import { ENTRANCE, buildPlatformGraph, policiesFor } from './canJump.js';
import { braidBlueInvariantErrors } from './level.js';

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
 * Moving-blue platform ids (dj behaviors, active under the blue item).
 * The bot passes THROUGH these, exactly like canJump's edges: a mover
 * landing keeps the player's x and re-launches next tick, so it's part
 * of a composite jump — never a planning anchor, never a leg end.
 */
function moverIds(level, abilities, C) {
    if (C.PLATFORM_BEHAVIORS?.blue !== 'moving' || !abilities?.blue) return null;
    const ids = (level.platforms ?? [])
        .filter((p) => p.type === 'blue' && p.sweep)
        .map((p) => p.id);
    return ids.length > 0 ? new Set(ids) : null;
}

/**
 * Forward-simulate one policy from the live state until the player
 * lands on a platform other than `fromId` (re-landing on the launch
 * platform re-launches, as in jumpQuery; bouncing through a pass-
 * through mover continues the leg), falls, or times out. Returns the
 * landing platform id or null.
 */
function simulatePolicy(level, startState, abilities, policyFn, fromId, C, through = null) {
    let state = startState;
    for (let frame = 1; frame <= SIM_MAX_FRAMES; frame++) {
        state = physicsStep(state, policyFn(state, frame), level, abilities, C);
        if (state.fallen) return null;
        if (state.landedOn && state.landedOn !== fromId
                && !through?.has(state.landedOn)) {
            return state.landedOn;
        }
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
    // Two cached canJump graphs per (level, abilities): a cheap climbOnly graph
    // tried first, and the full N² graph as the authoritative fallback when
    // climbOnly fails to route (see replan). Both are keyed on graphBase so a new
    // region or a freshly-granted item rebuilds them.
    let graphBase = null;
    let climbGraph = null;
    let fullGraph = null;

    // Moving-blue stepping stones: suppress sweep-phase enumeration in the graph
    // build (the same fast path the gated derive uses — 137→7ms/region; it's the
    // cost of entering a moving-blue region). Sound ONLY when every blue is a
    // green→blue→green column stone, so it's gated on that exact invariant: when
    // it holds, a blue is just a stepping stone and the suppressed edges are a
    // SUBSET of the ferry-aware ones (the bot never plans an impossible jump), and
    // placement already proved every goal reachable under this same suppressed
    // model (so the route still exists). When the invariant fails — Regime-1
    // decorative blues that ARE load-bearing, legacy ceiling blues — we keep the
    // ferry-aware model. Per-frame playback is identical either way: simulatePolicy
    // forward-sims from the LIVE state (real phase), waiting in place until the
    // blue sweeps over the column, then bouncing through it to the next platform.
    function buildGraph(level, abilities, climbOnly) {
        const suppressBlues = braidBlueInvariantErrors(level).length === 0;
        return buildPlatformGraph(level, abilities, { constants: C, suppressBlues, climbOnly });
    }

    function resetGraphsIfStale(level, abilities) {
        const base = `${level.id}|${abilitiesKey(abilities)}`;
        if (graphBase !== base) { graphBase = base; climbGraph = null; fullGraph = null; }
    }

    /**
     * The cheap climbOnly graph (upward edges only — see buildPlatformGraph). The
     * bot only climbs or recovers via the teleport→ENTRANCE edge, so this routes
     * every goal in a climbing braid at a fraction of the all-N² cost.
     */
    function ensureClimbGraph(level, abilities) {
        resetGraphsIfStale(level, abilities);
        if (!climbGraph) climbGraph = buildGraph(level, abilities, true);
        return climbGraph;
    }

    /**
     * The authoritative full N² graph — built only when the climbOnly graph fails
     * to route (a non-climbing-braid level, or a genuinely unreachable goal). It
     * is a SUPERSET of the climbOnly graph, so it can only ever find MORE routes:
     * climbOnly never yields a wrong answer, only an incomplete one, and this is
     * the safety net. Cached so a stuck goal rebuilds it at most once per base.
     */
    function ensureFullGraph(level, abilities) {
        resetGraphsIfStale(level, abilities);
        if (!fullGraph) fullGraph = buildGraph(level, abilities, false);
        return fullGraph;
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

        const isPortalOpen = helpers?.isPortalOpen ?? (() => true);
        // Avoid hosts of OPEN non-target portals (landing exits the
        // region mid-route) and platforms broken THIS attempt (dj
        // browns — the graph is attempt-agnostic; the live state knows;
        // a fall-respawn restores them along with state.broken).
        const blocked = new Set(
            (level.portals ?? [])
                .filter((pt) => pt.id !== target?.id && isPortalOpen(pt.id))
                .map((pt) => pt.on));
        for (const id of state.broken ?? []) blocked.add(id);
        // The graph routes a teleport-to-start host back to ENTRANCE (its
        // only out-edge), so on a braid this path naturally threads
        // lastPlatform → … → teleportHost → ENTRANCE → … → goalHost when the
        // goal is only reachable from below: the bot climbs to the teleport
        // host, lands (gameCore sends it home), and re-plans from the verified
        // low route. No descend needed — that's how the braid recovers from
        // an overshoot.
        // Try the cheap climbOnly graph first; if it can't route to the goal,
        // fall back to the authoritative full N² graph (a superset) before
        // concluding there's no route. `g` carries whichever graph answered, so
        // the entrance-fallback / leg-validation below all use it.
        const routeOver = (gr) => shortestPath(gr, lastPlatform, goalHost, blocked)
            ?? shortestPath(gr, lastPlatform, goalHost);
        let g = ensureClimbGraph(level, abilities);
        let path = routeOver(g);
        if (!path || path.length < 2) {
            g = ensureFullGraph(level, abilities);
            path = routeOver(g);
        }
        if (!path || path.length < 2) {
            // No jump route from here AND no teleport route home (a
            // teleport-less LEGACY COLUMN level — braids always carry a top
            // teleport, so they'd have found the route above). If the
            // entrance can reach the goal and we can steer, deliberately fall
            // off the level — the respawn IS the route down. Without arrows
            // we can't leave the column, so park and wait (items may still
            // arrive and change the graph). Removable once sphere growth
            // emits braids instead of columns (Regime-2 step 6).
            const hasTeleport = (level.teleports ?? []).length > 0;
            const fromEntrance = shortestPath(g, ENTRANCE, goalHost, blocked)
                ?? shortestPath(g, ENTRANCE, goalHost);
            if (!hasTeleport && fromEntrance && lastPlatform !== ENTRANCE
                    && (abilities.left || abilities.right)) {
                const dir = abilities.right ? { right: true } : { left: true };
                policyFn = () => dir;
                policyName = 'descend';
                return;
            }
            stuck = true;                   // retry at the next landing
            return;
        }
        // The next hop may LAND on a mover (a moving blue). The bot can't stop
        // there as a leg end — it bounces THROUGH, holding an arrow toward the
        // solid platform BEYOND it. So advance the leg target past any leading
        // movers in the path: they go into `through`, and the policy is aimed at
        // the first solid platform after them (policiesFor(legPlatform.x)), which
        // is what makes the bot steer OFF the blue toward that platform rather
        // than drifting straight up onto whatever shares its column. A mover that
        // is itself the goal host stays the target — the walk stops at path's end,
        // so the bot still lands on it (e.g. a pickup riding the blue).
        const movers = moverIds(level, abilities, C);
        let legIdx = 1;
        while (movers && legIdx < path.length - 1 && movers.has(path[legIdx])) legIdx += 1;
        const legTo = path[legIdx];
        const legPlatform = platformById(level, legTo);
        if (!legPlatform) { stuck = true; return; }

        // validation passes THROUGH movers (other than the leg target
        // itself) — the composite wait-land-bounce-off is one jump
        let through = movers;
        if (through?.has(legTo)) {
            through = new Set(through);
            through.delete(legTo);
        }
        const candidates = policiesFor(legPlatform.x, abilities, C);
        for (const candidate of candidates) {
            if (simulatePolicy(level, state, abilities, candidate.fn, lastPlatform, C, through) === legTo) {
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
            // EXCEPT moving blues: a mover landing keeps the player's
            // x and re-launches next tick — it's the middle of a
            // composite jump, never a planning anchor (planning "from"
            // a mover has no outgoing edges, which used to trigger the
            // DESCEND fallback and a fall-retry loop).
            const onMover = !!(state?.landedOn && level
                && moverIds(level, abilities, C)?.has(state.landedOn));
            if (state?.landedOn && !onMover) lastPlatform = state.landedOn;
            if (!target || !level) return null;
            if (onMover && policyFn) {
                // mid-composite mover bounce: keep flying the leg
                policyFrame += 1;
                return policyFn(state, policyFrame);
            }
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
