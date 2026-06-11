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

import {
    DEFAULTS, step as physicsStep, spawnState, wrapX, launchRise, platformXAt,
} from './physics.js';
import {
    isPlatformActive,
    activePlatforms,
    activeSprings,
    activeJetpacks,
} from './suppression.js';
import { reach, makeBfsSolver } from '../shared/simulatorCore.js';

export const ENTRANCE = 'entrance';

// ── Phase machinery (dj behaviors: moving blues, breaking browns) ────
//
// Moving platforms make edges PHASE-DEPENDENT. Phase is the session
// tick count t (deterministic; respawn resets t = 0). Quantification
// rules (sound, conservative):
//
//  - ENTRANCE edges run at exactly t = 0 — the spawn is deterministic.
//  - From a STATIC platform the player can WAIT (bounce in place), but
//    only in bounce-cycle steps: launch ticks are t_arr + k*cycle, so
//    the choosable phases alias to residues mod gcd(cycle, L) (L = lcm
//    of the blues' periods). The arrival residue is route-dependent,
//    so the edge needs a witness in EVERY residue class.
//  - From a MOVING blue the arrival phase is not choosable at all:
//    witnesses must cover EVERY phase in [0, L).
//  - From a breaking BROWN there are no edges: the measured weak
//    bounce (impact vy - 32.3 + 4, ≈ -6 at terminal) depends on the
//    route's arrival speed, so browns are goal hosts / one-landing
//    targets, never launch steps.
//
// Latched landings also rest at a route-dependent HOVER point (0 to
// ~MAX_FALL above the line), so dj launch states sample several hover
// heights; classic keeps its snap-exact drop path untouched.

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
function lcm(a, b) { return (a * b) / gcd(a, b); }

function movingBlues(level, abilities, C) {
    if (C.PLATFORM_BEHAVIORS?.blue !== 'moving') return [];
    return activePlatforms(level, abilities)
        .filter((p) => p.type === 'blue' && p.sweep);
}

/** lcm of the active moving blues' sweep periods (1 = no motion). */
function bluePhaseLcm(level, abilities, C) {
    let L = 1;
    for (const p of movingBlues(level, abilities, C)) {
        const span = p.sweep.max - p.sweep.min;
        const period = Math.max(1, Math.round((2 * span) / C.BLUE_SPEED));
        L = lcm(L, period);
    }
    return Math.min(L, 720); // cap pathological period combinations
}

/**
 * Ticks of one bounce-in-place cycle on `fromId` (landing → next
 * landing, no input) — the waiting granularity for phase aliasing.
 */
function bounceCycle(level, fromId, abilities, C) {
    const from = level.platforms.find((p) => p.id === fromId);
    if (!from) return 1;
    let s = launchedState(level, from, abilities, C, { rel: 0, hover: 0, t0: 0 });
    for (let i = 1; i <= 2000; i++) {
        s = physicsStep(s, null, level, abilities, C);
        if (s.landedOn === fromId) return i;
        if (s.fallen || s.landedOn) break;
    }
    return 0; // cannot wait here (no re-catch): phases are not choosable
}

/** A just-landed launch state on `from` (latched mode), at sweep phase
 *  t0, `rel` px from the platform center, `hover` px above the line. */
function launchedState(level, from, abilities, C, { rel, hover, t0 }) {
    const launch = launchTypeFor(level, from.id, abilities);
    const x = platformXAt(from, t0, C) + rel;
    return {
        x: C.WRAP === 'edge' ? x : wrapX(x, level.size.width),
        y: from.y - hover,
        vx: 0,
        vy: 0,
        fallen: false,
        landedOn: from.id,
        launch,
        t: t0,
        broken: [],
        latched: launch,
        jetpackTicks: 0,
    };
}

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
 * replays witnessed hops and aims jumps at portals. Flat air control
 * (dj) moves MOVE_FLAT px per held tick at 20Hz, so it gets finer
 * hold lengths than the accel model's 60Hz ones.
 */
export function policiesFor(targetX, abilities, C = DEFAULTS) {
    const policies = [{ name: 'none', fn: () => null }];
    if (!abilities.left && !abilities.right) return policies;
    policies.push({ name: 'seek', fn: seekPolicy(targetX, abilities) });
    if (abilities.right) policies.push({ name: 'holdRight', fn: () => ({ right: true }) });
    if (abilities.left) policies.push({ name: 'holdLeft', fn: () => ({ left: true }) });
    const holds = C.AIR_CONTROL === 'flat' ? [2, 5, 10, 20] : [10, 20, 40];
    for (const f of holds) {
        if (abilities.right) {
            policies.push({ name: `right${f}`, fn: (s, frame) => (frame <= f ? { right: true } : null) });
        }
        if (abilities.left) {
            policies.push({ name: `left${f}`, fn: (s, frame) => (frame <= f ? { left: true } : null) });
        }
    }
    return policies;
}

/** Launch type granted by `fromId` under `abilities` (suppression-aware). */
function launchTypeFor(level, fromId, abilities) {
    if (activeJetpacks(level, abilities).some((j) => j.on === fromId)) return 'jetpack';
    if (activeSprings(level, abilities).some((s) => s.on === fromId)) return 'spring';
    return 'bounce';
}

/** Sampled launch x positions across the from-platform's catch span
 *  (wrap-normalized — there are no side walls). */
function launchXs(level, fromId, abilities, C, opts) {
    if (fromId === ENTRANCE) return [level.size.width / 2];
    const from = platformById(level, fromId);
    const halfSpan = C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
    const x0Step = opts.x0Step ?? halfSpan / 2;
    const xs = new Set();
    for (let dx = -halfSpan; dx <= halfSpan + 1e-9; dx += x0Step) {
        xs.add(wrapX(from.x + dx, level.size.width));
    }
    return [...xs];
}

/** Run one latched-mode launch from a synthesized just-landed state
 *  until the player lands elsewhere, falls, or times out. */
function latchedJumpRun(level, from, abilities, C, startSpec, policy, maxFrames) {
    let state = launchedState(level, from, abilities, C, startSpec);
    let policyFrame = 0;
    for (let i = 1; i <= maxFrames; i++) {
        state = physicsStep(state, policy(state, ++policyFrame), level, abilities, C);
        if (state.fallen) return null;
        if (state.landedOn && state.landedOn !== from.id) return state.landedOn;
        // re-landing on `from` re-launches (waiting / drift correction)
    }
    return null;
}

/**
 * Detailed edge query: `{ ok, witnesses }` where witnesses (one per
 * sampled launch condition when ok) record which policy made the jump.
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
        // Breaking browns are goal hosts, never launch steps: the weak
        // bounce's strength depends on the route's arrival speed (see
        // the phase-machinery header).
        if (from.type === 'brown' && C.PLATFORM_BEHAVIORS?.brown === 'breaking') {
            return fail;
        }
        fromY = from.y;
    }

    // Cheap pre-filter: a launch can never gain more height than its
    // measured discrete rise (plus the latched-mode hover allowance —
    // the launch point can rest up to ~MAX_FALL above the line); skip
    // the simulation when `to` is above that. The entrance has no
    // launch: its only gain is the spawn drop itself (none).
    if (fromId !== ENTRANCE) {
        const rise = launchRise(launchTypeFor(level, fromId, abilities), C);
        const hover = C.LANDING === 'latched' ? C.MAX_FALL : 0;
        if (fromY - to.y > rise + hover) return fail;
    } else if (fromY - to.y > 0) {
        return fail;
    }

    if (C.LANDING === 'latched' && fromId !== ENTRANCE) {
        return latchedCanJump(level, fromId, to, abilities, C, opts);
    }

    // Classic path (and latched ENTRANCE queries — the spawn drop at
    // t = 0 is deterministic, jumpQuery handles it via spawnState).
    const witnesses = [];
    for (const x0 of launchXs(level, fromId, abilities, C, opts)) {
        let witness = null;
        for (const policy of policiesFor(to.x, abilities, C)) {
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

/**
 * Latched-mode (dj) edge query from a platform. Quantifies over the
 * launch conditions the player cannot choose — landing offset within
 * the catch span, hover height, and (per the phase rules in the
 * header) sweep phase — and existentially over policies and choosable
 * phases. Fails closed on every axis.
 */
function latchedCanJump(level, fromId, to, abilities, C, opts) {
    const fail = { ok: false, witnesses: [] };
    const from = platformById(level, fromId);
    const maxFrames = opts.maxFrames ?? 600;
    const targetX = to.sweep ? (to.sweep.min + to.sweep.max) / 2 : to.x;
    const policies = policiesFor(targetX, abilities, C);

    const halfSpan = C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
    const x0Step = opts.x0Step ?? halfSpan / 2;
    const rels = [];
    for (let r = -halfSpan; r <= halfSpan + 1e-9; r += x0Step) rels.push(r);
    // Hover heights (route-dependent rest point above the line). Not
    // an interval analysis: a sub-sample-width interception window can
    // escape — the generator's overshoot margins keep those away.
    const hovers = [0, 7.3, 14.7, Math.max(0, C.MAX_FALL - 0.05)];

    const L = bluePhaseLcm(level, abilities, C);
    const fromMoving = movingBlues(level, abilities, C).some((p) => p.id === fromId);

    // Phase sets to satisfy: from a moving platform EVERY phase must
    // have a witness; from a static one, every residue class mod
    // gcd(cycle, L) must (waiting reaches only its own class). cycle 0
    // = cannot wait here → treat like moving (no phase choice).
    let phaseGroups;
    if (L === 1) {
        phaseGroups = [[0]];
    } else if (fromMoving) {
        phaseGroups = Array.from({ length: L }, (_, t) => [t]);
    } else {
        const cycle = bounceCycle(level, fromId, abilities, C);
        const g = cycle > 0 ? gcd(cycle, L) : L;
        phaseGroups = Array.from({ length: g }, (_, r) => {
            const group = [];
            for (let t = r; t < L; t += g) group.push(t);
            return group;
        });
    }

    const witnesses = [];
    for (const rel of rels) {
        for (const hover of hovers) {
            for (const group of phaseGroups) {
                let witness = null;
                for (const t0 of group) {
                    for (const policy of policies) {
                        const landed = latchedJumpRun(
                            level, from, abilities, C,
                            { rel, hover, t0 }, policy.fn, maxFrames,
                        );
                        if (landed === to.id) {
                            witness = { x0: rel, hover, t0, policy: policy.name };
                            break;
                        }
                    }
                    if (witness) break;
                }
                if (!witness) return fail;
                witnesses.push(witness);
            }
        }
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
