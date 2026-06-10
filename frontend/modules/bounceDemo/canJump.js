/**
 * Bounce Demo `canJump` — build-order step 2
 * (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md). A
 * conservative forward-query sampler of `step`: it never simulates
 * physics of its own — every answer comes from running the real engine
 * forward, so `step` and `canJump` cannot disagree by construction.
 *
 * Per-jump semantics: the edge A→B exists iff, from EVERY sampled
 * launch x across A's catch span, SOME sampled input policy makes the
 * player's next landing on a *different* platform be B. Re-landing on
 * A (multi-bounce drift) does not end the jump. The ∀x0 is because the
 * player cannot always choose where on A they arrive (arrows may be
 * locked); the ∃policy is because the player chooses the inputs.
 *
 * Conservative by design: the policy family is finite, so real edges
 * can be missed — pessimistic, the safe direction (derived rules never
 * claim a jump the player can't make). The x0 grid density is
 * `opts.x0Step` if a level ever needs finer sampling.
 *
 * The platform graph feeds `simulatorCore.js`'s solver: node = platform
 * id (plus ENTRANCE), input = jump target, and a returned plan is the
 * platform sequence itself — the same data the eventual playback bot
 * replays.
 */

import { DEFAULTS, step as physicsStep, spawnState } from './physics.js';
import {
    isPlatformActive,
    activePlatforms,
    activeSprings,
    activeJetpacks,
} from './suppression.js';
import { reach, makeBfsSolver } from '../shared/simulatorCore.js';

export const ENTRANCE = 'entrance';

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

function platformById(level, id) {
    return level.platforms.find((p) => p.id === id) ?? null;
}

/**
 * Run one launch from `fromId` (a platform id or ENTRANCE) under one
 * input policy, through the real engine, until the player lands on a
 * different platform, falls, or times out. Returns
 * `{ landedOn, fell, timedOut, pickupsTouched, portalsTouched }`.
 *
 * Platform launches drop the player just above the platform at `x0` so
 * the engine itself performs the landing and the (suppression-aware)
 * spring/jetpack launch — no duplicated launch logic here.
 */
export function jumpQuery(level, fromId, abilities, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const maxFrames = opts.maxFrames ?? 600;
    const policy = opts.policy ?? (() => null);

    let state;
    if (fromId === ENTRANCE) {
        state = spawnState(level, C);
        if (opts.x0 !== undefined) state = { ...state, x: opts.x0 };
    } else {
        const from = platformById(level, fromId);
        if (!from) throw new Error(`jumpQuery: unknown platform '${fromId}'`);
        state = {
            x: opts.x0 ?? from.x,
            y: from.y - 4,
            vx: 0,
            vy: 4,
            fallen: false,
            landedOn: null,
            launch: null,
        };
    }

    const pickupsTouched = new Set();
    const portalsTouched = new Set();
    // pickups and portals are landing-triggered on their host platform
    // — same semantics as physics.simulate
    const touch = (s) => {
        if (!s.landedOn) return;
        for (const pk of level.pickups ?? []) {
            if (pk.on === s.landedOn) pickupsTouched.add(pk.id);
        }
        for (const pt of level.portals ?? []) {
            if (pt.on === s.landedOn) portalsTouched.add(pt.id);
        }
    };

    const done = (over) => ({
        landedOn: null,
        fell: false,
        timedOut: false,
        pickupsTouched: [...pickupsTouched],
        portalsTouched: [...portalsTouched],
        ...over,
    });

    // The policy engages at the launch bounce, not during the drop —
    // x0 is where the player ARRIVED on the platform; steering starts
    // when they jump. (Entrance queries steer from the first frame:
    // the spawn fall is itself the move.)
    let launched = fromId === ENTRANCE;
    let policyFrame = 0;

    touch(state);
    for (let i = 1; i <= maxFrames; i++) {
        const input = launched ? policy(state, ++policyFrame) : null;
        state = physicsStep(state, input, level, abilities, C);
        touch(state);
        if (state.fallen) return done({ fell: true });
        if (state.landedOn) {
            if (!launched) {
                // the pre-launch drop must land on the launch platform;
                // anything else means x0 wasn't really a spot on it
                if (state.landedOn !== fromId) return done({});
                launched = true;
            } else if (state.landedOn !== fromId) {
                return done({
                    landedOn: state.landedOn,
                    landing: { x: state.x, y: state.y },
                });
            }
            // re-landing on the launch platform just re-launches — keep going
        }
    }
    return done({ timedOut: true });
}

function seekPolicy(targetX, abilities, deadzone = 4) {
    return (state) => {
        if (state.x < targetX - deadzone && abilities.right) return { right: true };
        if (state.x > targetX + deadzone && abilities.left) return { left: true };
        return null;
    };
}

/**
 * The sampled input-policy family for a jump aimed at `targetX`. Only
 * unlocked directions appear. Order is cheapest-first; canJump stops
 * at the first witness. Exported for the derive-rules verifier, which
 * replays witnessed hops and aims jumps at portals.
 */
export function policiesFor(targetX, abilities) {
    const policies = [{ name: 'none', fn: () => null }];
    if (!abilities.left && !abilities.right) return policies;
    policies.push({ name: 'seek', fn: seekPolicy(targetX, abilities) });
    if (abilities.right) policies.push({ name: 'holdRight', fn: () => ({ right: true }) });
    if (abilities.left) policies.push({ name: 'holdLeft', fn: () => ({ left: true }) });
    for (const f of [10, 20, 40]) {
        if (abilities.right) {
            policies.push({ name: `right${f}`, fn: (s, frame) => (frame <= f ? { right: true } : null) });
        }
        if (abilities.left) {
            policies.push({ name: `left${f}`, fn: (s, frame) => (frame <= f ? { left: true } : null) });
        }
    }
    return policies;
}

/** Launch vy granted by `fromId` under `abilities` (suppression-aware). */
function launchVyFor(level, fromId, abilities, C) {
    if (fromId === ENTRANCE) return 0;
    if (activeJetpacks(level, abilities).some((j) => j.on === fromId)) return C.JETPACK_VY;
    if (activeSprings(level, abilities).some((s) => s.on === fromId)) return C.SPRING_VY;
    return C.BOUNCE_VY;
}

/** Sampled launch x positions across the from-platform's catch span. */
function launchXs(level, fromId, abilities, C, opts) {
    if (fromId === ENTRANCE) return [level.size.width / 2];
    const from = platformById(level, fromId);
    const halfSpan = C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
    const x0Step = opts.x0Step ?? halfSpan / 2;
    const xs = new Set();
    for (let dx = -halfSpan; dx <= halfSpan + 1e-9; dx += x0Step) {
        xs.add(clamp(from.x + dx, C.PLAYER_HALF_WIDTH, level.size.width - C.PLAYER_HALF_WIDTH));
    }
    return [...xs];
}

/**
 * Detailed edge query: `{ ok, witnesses }` where witnesses (one per
 * sampled x0 when ok) record which policy made the jump.
 */
export function canJumpDetailed(level, fromId, toId, abilities, opts = {}) {
    const C = opts.constants ?? DEFAULTS;
    const fail = { ok: false, witnesses: [] };

    const to = platformById(level, toId);
    if (!to || !isPlatformActive(to, abilities)) return fail;
    let fromY;
    if (fromId === ENTRANCE) {
        fromY = level.size.height - C.SPAWN_HEIGHT;
    } else {
        const from = platformById(level, fromId);
        if (!from || !isPlatformActive(from, abilities)) return fail;
        fromY = from.y;
    }

    // Cheap pre-filter: a launch can never gain more height than its
    // impulse apex; skip the simulation when `to` is above that.
    const vy0 = launchVyFor(level, fromId, abilities, C);
    const apexGain = (vy0 * vy0) / (2 * C.GRAVITY);
    if (fromY - to.y > apexGain) return fail;

    const witnesses = [];
    for (const x0 of launchXs(level, fromId, abilities, C, opts)) {
        let witness = null;
        for (const policy of policiesFor(to.x, abilities)) {
            const r = jumpQuery(level, fromId, abilities, { ...opts, x0, policy: policy.fn });
            if (r.landedOn === toId) {
                witness = { x0, policy: policy.name };
                break;
            }
        }
        if (!witness) return fail; // some launch position cannot make it
        witnesses.push(witness);
    }
    return { ok: true, witnesses };
}

export function canJump(level, fromId, toId, abilities, opts = {}) {
    return canJumpDetailed(level, fromId, toId, abilities, opts).ok;
}

/**
 * Build the per-jump platform graph for one ability set:
 * `{ level, abilities, nodes, edges }` with `edges: Map<id, Set<id>>`.
 * Nodes are ENTRANCE plus the *active* platforms — suppressed
 * platforms don't exist under this ability set.
 */
export function buildPlatformGraph(level, abilities, opts = {}) {
    const platforms = activePlatforms(level, abilities);
    const nodes = [ENTRANCE, ...platforms.map((p) => p.id)];
    const edges = new Map(nodes.map((n) => [n, new Set()]));
    for (const from of nodes) {
        for (const p of platforms) {
            if (p.id === from) continue;
            if (canJump(level, from, p.id, abilities, opts)) {
                edges.get(from).add(p.id);
            }
        }
    }
    return { level, abilities, nodes, edges };
}

/**
 * simulatorCore solver over a platform graph: state = node id, input =
 * target platform id, step succeeds iff the edge exists. A returned
 * plan is the jump sequence ['p0', 'p1', ...].
 */
export function makeJumpSolver(graph) {
    return makeBfsSolver({
        step: (world, nodeId, target) => (world.edges.get(nodeId)?.has(target) ? target : null),
        inputs: graph.nodes.filter((n) => n !== ENTRANCE),
        visitedKey: (nodeId) => nodeId,
    });
}

/** Shortest jump path entrance → `toId` via simulatorCore's reach. */
export function findJumpPath(graph, toId, options = {}) {
    return reach(graph, makeJumpSolver(graph), ENTRANCE, (nodeId) => nodeId === toId, options);
}

/** All platforms reachable from the entrance (flood fill over edges). */
export function reachablePlatforms(graph) {
    const seen = new Set([ENTRANCE]);
    const queue = [ENTRANCE];
    while (queue.length > 0) {
        const n = queue.shift();
        for (const next of graph.edges.get(n) ?? []) {
            if (!seen.has(next)) {
                seen.add(next);
                queue.push(next);
            }
        }
    }
    seen.delete(ENTRANCE);
    return seen;
}
