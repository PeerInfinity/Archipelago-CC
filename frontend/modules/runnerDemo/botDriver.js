/**
 * Runner bot driver — the playback bot's game-side input synthesizer
 * (plan §4.8; bounceDemo/botDriver.js is the model). Greedy re-plan
 * controller, simplified by auto-run: on every landing it recomputes
 * the shortest leg path from the current platform to the target goal's
 * host over the canRun graph, takes the next leg, and picks an input
 * policy by forward-simulating candidates from the LIVE state through
 * the real engine (the same `step` the game runs — driver and game
 * cannot disagree by construction). No stored plan: divergence (a
 * missed jump, a re-landing, a mid-flight item grant) just means the
 * next landing re-plans from wherever the player actually is. On flat
 * stretches the chosen "policy" is `none` — auto-run IS the plan.
 *
 * The driver is Archipelago-naive: targets arrive as game-local goal
 * ids ({ kind: 'pickup' | 'portal', id }) — the host bridge translates
 * AP location / exit names before calling in (flashSubstrate/bridge.js
 * _translateWalkTo). It emits per-frame inputs only; collection/exit
 * semantics stay in gameCore.
 *
 * Re-plan trigger (runner-specific): a landing edge is `state.landedOn`
 * OR `standingOn` switching to a different platform — auto-run crosses
 * FLUSH platform boundaries without ever going airborne, so landedOn
 * alone would miss those legs (the same reason canRun's legs end on
 * standingOn switches). Respawns are observed from `state.respawned`
 * (runner physics respawns INSIDE step, unlike bounce's harness-side
 * respawn), so there is no notifyFell in this driver's surface.
 *
 * RECOVERY — the reset key: auto-run's x-monotonicity means a goal
 * BEHIND the player is unreachable by any forward leg, so the graph
 * gives every node an implicit edge → ENTRANCE at the cost of one
 * respawn (cleaner than bounce's teleport-host / deliberate-fall
 * pair, and always available — plan §1 keeps the reset key live).
 * The reset edge is only taken when the entrance CAN route to the
 * goal under the current abilities; otherwise the driver is stuck
 * and emits nothing (items may still arrive and change the graph).
 *
 * BLOCKED-HOST AVOIDANCE: hosts of OPEN non-target portals are
 * avoided twice over —
 *  - route level, exactly like bounce's replan: blocked as
 *    intermediate hops, falling back to an unfiltered path when
 *    avoidance walls the goal off (generated levels CAN put a branch
 *    tip on the mandatory path);
 *  - candidate level: a policy whose live-state sim touches an open
 *    non-target portal box is rejected while a clean candidate
 *    exists, and legs INTO such a host prefer the LEFTMOST clean
 *    landing — landing deep on a branch tip can leave no jump-off
 *    point before its portal box, so the leg in must not spend the
 *    tip's width. This is what "jump off the tip before its portal
 *    box" means mechanically.
 *
 * A locked TARGET needs little special handling: the driver still
 * drives to the goal host (routing ignores the target's own gate) and
 * then parks — no input; on wall-abutting hosts (exit_main, the
 * common gated case) auto-run pins the player harmlessly against the
 * side wall. When the gate opens the driver synthesizes one full
 * jump: gameCore's goal events fire on touch-ENTER, and a player
 * pinned INSIDE the locked portal's box must leave and re-enter it
 * for the now-open portal to arm. Interior locked hosts can't park
 * under auto-run (the run always carries the player off); the
 * die-retry loop that follows is the honest v1 behavior there.
 */

import { DEFAULTS, step as physicsStep } from './physics.js';
import {
    ENTRANCE, canRunDetailed, runQuery, survivesFrom, policiesFor,
} from './canRun.js';
import { activePlatforms, effectiveParams } from './suppression.js';

const SIM_MAX_FRAMES = 600;

/** Host platform id for a goal, or null when the goal isn't in this level. */
function resolveGoalHost(level, target) {
    if (!target) return null;
    const pool = target.kind === 'pickup' ? level.pickups : level.portals;
    return (pool ?? []).find((g) => g.id === target.id)?.on ?? null;
}

/** Stable cache key for the ability set (graph reuse across landings). */
function abilitiesKey(abilities) {
    return Object.keys(abilities ?? {}).filter((k) => abilities[k]).sort().join(',');
}

function isGoalOpen(helpers, target) {
    if (!target) return true;
    const probe = target.kind === 'portal'
        ? helpers?.isPortalOpen : helpers?.isPickupOpen;
    return probe ? probe(target.id) !== false : true;
}

export function createBotDriver(opts = {}) {
    const C = opts.constants ?? DEFAULTS;

    let target = null;          // { kind: 'pickup' | 'portal', id }
    let lastPlatform = null;    // current support (null while airborne/fresh)
    let policyFn = null;        // active policy until the next landing
    let policyFrame = 0;        // -1 = plan eagerly at the next grounded frame
    let policyName = null;
    let nextPlatform = null;    // the leg's destination (status surface)
    let stuck = false;          // no route at the last re-plan
    let parkedLocked = false;   // on the goal host, target gate closed

    // Lazily-expanded canRun edge cache per (level, abilities): BFS only
    // ever expands nodes the route actually visits, and the expansions +
    // doom memo persist across landings (a new region or a freshly-
    // granted item rebuilds them — same keying as bounce's graphBase).
    let graphKey = null;
    let expansions = null;      // fromId -> { edges: Set, touches: Set }
    let doomCache = null;

    function ensureGraphBase(level, abilities) {
        const key = `${level.id}|${abilitiesKey(abilities)}`;
        if (graphKey !== key) {
            graphKey = key;
            expansions = new Map();
            doomCache = new Map();
        }
    }

    /** All canRun legs out of `fromId` (launch edges chain; touch edges
     *  grant goals — usable only as a route's FINAL hop). The x-prune
     *  mirrors reachableRunPlatforms: under AUTO_RUN vx is never
     *  negative, so a leg can't end wholly left of its launch. */
    function expand(level, abilities, fromId) {
        if (expansions.has(fromId)) return expansions.get(fromId);
        const legOpts = { constants: C, doomCache };
        const out = { edges: new Set(), touches: new Set() };
        if (fromId === ENTRANCE) {
            // The entry leg takes no inputs (deterministic spawn drop).
            const r = runQuery(level, ENTRANCE, abilities, { ...legOpts, policy: null });
            if (r.landedOn) {
                out.touches.add(r.landedOn);
                if (survivesFrom(level, r.landedOn, r.landingState, abilities, legOpts)) {
                    out.edges.add(r.landedOn);
                }
            }
        } else {
            const platforms = activePlatforms(level, abilities);
            const from = platforms.find((p) => p.id === fromId);
            for (const p of from ? platforms : []) {
                if (p.id === fromId) continue;
                if (p.x + p.w < from.x - C.PLAYER_W) continue; // the x-prune
                const r = canRunDetailed(level, fromId, p.id, abilities, legOpts);
                if (r.touch) out.touches.add(p.id);
                if (r.ok) out.edges.add(p.id);
            }
        }
        expansions.set(fromId, out);
        return out;
    }

    /**
     * BFS shortest leg path `fromId` → `goalHost` over lazily-expanded
     * launch edges (touch edges admitted only as the final hop — a
     * touch-grade host still collects its wake goals, it just can't
     * chain onward), refusing to pass THROUGH blocked hosts (the goal
     * itself is always allowed). Returns [from, ..., goalHost] or null.
     */
    function routeTo(level, abilities, fromId, goalHost, blocked) {
        if (fromId === goalHost) return [fromId];
        const prev = new Map([[fromId, null]]);
        const queue = [fromId];
        while (queue.length > 0) {
            const node = queue.shift();
            const { edges, touches } = expand(level, abilities, node);
            const nexts = touches.has(goalHost) ? new Set([...edges, goalHost]) : edges;
            for (const next of nexts) {
                if (prev.has(next)) continue;
                if (next !== goalHost && blocked.has(next)) continue;
                prev.set(next, node);
                if (next === goalHost) {
                    const path = [goalHost];
                    let p = node;
                    while (p !== null) { path.unshift(p); p = prev.get(p); }
                    return path;
                }
                queue.push(next);
            }
        }
        return null;
    }

    /**
     * Forward-simulate one policy instance from the live state until
     * the player's support switches off `fromId`, the target goal's
     * box is touched (success even without a landing — goals trigger
     * on touch), death, or timeout. Tracks every portal box touched
     * en route for the open-portal cleanliness check.
     */
    function simulateFromLive(level, startState, abilities, policy, fromId, goal) {
        let state = startState;
        const portals = new Set();
        for (let frame = 1; frame <= SIM_MAX_FRAMES; frame++) {
            state = physicsStep(state, policy(state, frame), level, abilities, C);
            for (const id of state.touchedPortals) portals.add(id);
            if (state.respawned) return { died: true, portals };
            if (goal?.kind === 'pickup' && state.touchedPickups.includes(goal.id)) {
                return { goalTouched: true, portals };
            }
            if (goal?.kind === 'portal' && portals.has(goal.id)) {
                return { goalTouched: true, portals };
            }
            if (state.standingOn && state.standingOn !== fromId) {
                return {
                    landedOn: state.standingOn,
                    landingX: state.x,
                    landingState: state, // liveness check (replan)
                    portals,
                };
            }
        }
        return { timedOut: true, portals };
    }

    /** One synthesized full jump — the parked-and-unlocked re-arm: leave
     *  the goal box vertically and re-enter it (touch-ENTER re-fires). */
    function reEnterJump(abilities) {
        const C_eff = effectiveParams(C, abilities ?? {});
        const hold = Math.ceil(C_eff.timeToJumpApex * C_eff.TICK_HZ) + 2;
        let n = 0;
        return () => (n++ < hold ? { jump: true } : null);
    }

    /** Press reset once (physics respawns on that very tick). */
    function resetPolicy() {
        let fired = false;
        return () => {
            if (fired) return null;
            fired = true;
            return { reset: true };
        };
    }

    /**
     * Re-plan from `lastPlatform` (grounded): route to the goal host
     * (blocked-host avoidance with unfiltered fallback), then pick the
     * first candidate policy whose live-state sim completes the next
     * leg cleanly. Routing deliberately ignores the TARGET's own gate
     * state — a locked target still gets driven to and parked at.
     */
    function replan(state, level, abilities, helpers) {
        policyFn = null;
        policyFrame = 0;
        policyName = null;
        nextPlatform = null;
        stuck = false;
        parkedLocked = false;

        const goalHost = resolveGoalHost(level, target);
        if (!goalHost) return;              // not this region's goal — wait
        ensureGraphBase(level, abilities);

        const isPortalOpen = helpers?.isPortalOpen ?? (() => true);
        if (lastPlatform === goalHost) {
            // Arrived: the goal box sits in this host's auto-run wake,
            // so no input reaches it. A closed gate parks instead
            // (nextInput watches for the open transition).
            parkedLocked = !isGoalOpen(helpers, target);
            return;
        }

        // Hosts of OPEN non-target portals: touching one exits the
        // region mid-route. Locked portals are harmless (lockedPortal
        // event, no exit) and stay routable.
        const openForeign = new Set(
            (level.portals ?? [])
                .filter((pt) => pt.id !== target?.id && isPortalOpen(pt.id) !== false)
                .map((pt) => pt.id));
        const blocked = new Set(
            (level.portals ?? [])
                .filter((pt) => openForeign.has(pt.id))
                .map((pt) => pt.on));

        const route = (fromId) =>
            routeTo(level, abilities, fromId, goalHost, blocked)
            ?? routeTo(level, abilities, fromId, goalHost, new Set());
        let path = route(lastPlatform);
        if (!path || path.length < 2) {
            // No forward route (auto-run can never go LEFT, so a goal
            // behind the player lands here): the implicit reset edge —
            // one respawn returns the player to the entrance, worth
            // pressing only when the entrance can actually route.
            const fromEntrance = route(ENTRANCE);
            if (fromEntrance && fromEntrance.length >= 2) {
                policyFn = resetPolicy();
                policyName = 'reset';
                nextPlatform = ENTRANCE;
                return;
            }
            stuck = true;                   // retry at the next landing
            return;
        }

        const legTo = path[1];
        const from = activePlatforms(level, abilities).find((p) => p.id === lastPlatform);
        if (!from) { stuck = true; return; }
        // Only the FINAL leg may touch the target goal's box mid-sim
        // (and only when its gate is open — a locked touch does
        // nothing, so it can't count as completing anything).
        const goal = (legTo === goalHost && isGoalOpen(helpers, target)) ? target : null;

        // First candidate whose live sim completes the leg without
        // touching an open non-target portal box AND whose landing is
        // LIVE (survivesFrom — the same discipline canRun's witnesses
        // obey: a completion into a doom window is a guaranteed death
        // on the next leg, worse than either alternative below). When
        // the leg's DESTINATION itself hosts an open portal (a forced
        // crossing of a branch tip), prefer the LEFTMOST clean landing
        // — deep landings can leave no jump-off point before the box.
        // Fallback order: clean+live > dirty (fires a foreign portal —
        // exits the region, recoverable) > clean-but-doomed (dies and
        // retries — last resort only).
        const wantLeftmost = blocked.has(legTo);
        const liveOpts = { constants: C, doomCache };
        let best = null;                    // clean + live (leftmost if wanted)
        let dirty = null;                   // completes, but exits the region
        let doomed = null;                  // completes cleanly into a doom window
        for (const candidate of policiesFor(level, from, abilities, { constants: C })) {
            const r = simulateFromLive(
                level, state, abilities, candidate.make(), lastPlatform, goal);
            if (!(r.goalTouched || r.landedOn === legTo)) continue;
            const touchedOpenForeign = [...r.portals].some((id) => openForeign.has(id));
            if (touchedOpenForeign) { dirty ??= candidate; continue; }
            if (r.goalTouched) { best = candidate; break; }
            if (!survivesFrom(level, r.landedOn, r.landingState, abilities, liveOpts)) {
                doomed ??= candidate;
                continue;
            }
            if (!wantLeftmost) { best = candidate; break; }
            if (!best || r.landingX < best.landingX) {
                best = { name: candidate.name, make: candidate.make, landingX: r.landingX };
            }
        }
        const picked = best ?? dirty ?? doomed;
        if (picked) {
            policyFn = picked.make();
            policyName = best ? picked.name
                : `${picked.name} (${picked === dirty ? 'through open portal' : 'doomed landing'})`;
            nextPlatform = legTo;
            return;
        }
        // The edge exists but no candidate validates from THIS exact
        // state. There is no steering to force under auto-run — emit
        // nothing; the run perturbs the state on its own (a fall
        // respawns, a re-landing re-plans).
        stuck = true;
    }

    return {
        setTarget(goal) {
            target = goal ?? null;
            policyFn = null;
            // Plan eagerly at the next grounded frame (treat it like a
            // landing) so a mid-platform walkTo engages immediately.
            policyFrame = -1;
        },

        clearTarget() {
            target = null;
            policyFn = null;
            policyName = null;
            nextPlatform = null;
            stuck = false;
            parkedLocked = false;
        },

        getStatus() {
            return {
                active: target !== null,
                target,
                lastPlatform,
                nextPlatform,
                policy: policyName,
                stuck,
                parked: parkedLocked,
            };
        },

        /**
         * Per-frame input for the game loop. Null when idle, when the
         * target isn't resolvable in this level, or when the active
         * policy says "no input this frame". Contract (game/main.js):
         * called BEFORE session.tick with the PREVIOUS tick's state,
         * so each landing/respawn is observed exactly once.
         */
        nextInput(state, level, abilities, helpers = {}) {
            // Respawn (fell / hazard / reset — physics respawns inside
            // step): the active policy's trigger bookkeeping is bogus
            // now. lastPlatform = null so even a respawn back onto the
            // SAME platform reads as a fresh landing edge below.
            if (state?.respawned) {
                policyFn = null;
                policyName = null;
                lastPlatform = null;
            }
            // Landing edge: an airborne landing (landedOn) OR a flush
            // walk-over (standingOn switch with no airborne tick).
            // Tracked even while idle so the first walkTo plans from
            // the platform the auto-run actually reached.
            const support = state?.standingOn ?? null;
            const landingEdge = !!state?.landedOn
                || (support !== null && support !== lastPlatform);
            if (support !== null) lastPlatform = support;
            if (!target || !level) return null;
            if ((landingEdge || policyFrame === -1) && support !== null) {
                replan(state, level, abilities, helpers);
            }
            // Parked on the goal host while its gate was closed: when
            // the host pushes fresh gate states and it opens, one full
            // jump leaves + re-enters the goal box (touch-ENTER arms).
            if (!policyFn && parkedLocked && isGoalOpen(helpers, target)) {
                parkedLocked = false;
                policyFn = reEnterJump(abilities);
                policyName = 're-enter';
            }
            if (!policyFn) { policyFrame = Math.max(policyFrame, 0); return null; }
            policyFrame += 1;
            return policyFn(state, policyFrame);
        },
    };
}
