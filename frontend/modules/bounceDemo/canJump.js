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

/**
 * Is `platformId` the host of a teleport-to-start object? Such a host is a
 * verifier terminal — landing on it returns the player to the entrance, so it
 * has no outgoing climb edges (additive: levels without `teleports` are
 * unaffected). Tiny scan; `teleports` holds at most a few entries per level.
 */
export function isTeleportHost(level, platformId) {
    const teleports = level.teleports;
    if (!teleports) return false; // hot path: most levels carry no teleports
    for (const t of teleports) if (t.on === platformId) return true;
    return false;
}

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
//  - Edge runs pass THROUGH moving blues: landing on one keeps the
//    player's x (no snap, no velocity inheritance — measured) and the
//    next-tick bounce relaunches from that same x, so "wait on the
//    static rung for the right phase, land on the mover, bounce
//    straight off" is one composite maneuver controlled entirely by
//    the launch phase. The edge green→C is witnessed by the real
//    chained trajectory; the blue is an implementation detail of the
//    jump. (Direct from-a-moving-blue edges still exist for
//    completeness and quantify ∀ phases — without a known
//    predecessor the arrival state is route-dependent.)
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

/** Ids of platforms an edge run may bounce THROUGH without ending the
 *  leg (moving blues — see the pass-through note in the header). */
function passThroughIds(level, abilities, C) {
    const blues = movingBlues(level, abilities, C);
    return blues.length > 0 ? new Set(blues.map((p) => p.id)) : null;
}

/**
 * The movers an edge run launched from `fromY` can possibly TOUCH.
 * Phase (state.t) only enters `step` through mover catch tests, so a
 * run that cannot reach any mover's catch band is IDENTICAL at every
 * phase — its edge needs exactly one phase. A mover is touchable iff
 * the run's highest point reaches its band's bottom (falls reach
 * everything below for free), and touching one mover lifts the bound
 * by another plain bounce (cascade to fixpoint).
 */
function touchableMovers(level, fromY, fromLaunch, C, movers) {
    if (movers.length === 0) return [];
    const hover = C.MAX_FALL; // latched landings rest up to here above the line
    let apex = fromLaunch === null
        ? fromY // ENTRANCE: the spawn drop gains no height
        : fromY - hover - launchRise(fromLaunch, C);
    const touched = new Set();
    let changed = true;
    while (changed) {
        changed = false;
        for (const p of movers) {
            if (touched.has(p.id)) continue;
            if (apex <= p.y + C.CATCH_BAND) { // band reachable (y grows down)
                touched.add(p.id);
                const lifted = p.y - hover - launchRise('bounce', C);
                if (lifted < apex) apex = lifted;
                changed = true;
            }
        }
    }
    return movers.filter((p) => touched.has(p.id));
}

/** lcm of the given movers' sweep periods (1 = no motion). */
function phaseLcm(movers, C) {
    let L = 1;
    for (const p of movers) {
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
            } else if (state.landedOn !== fromId
                    && !opts.through?.has(state.landedOn)) {
                return done({
                    landedOn: state.landedOn,
                    landing: { x: state.x, y: state.y },
                });
            }
            // re-landing on the launch platform (or bouncing through a
            // pass-through mover) just re-launches — keep going
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
 *  until the player lands elsewhere (pass-through movers excepted),
 *  falls, or times out. */
function latchedJumpRun(level, from, abilities, C, startSpec, policy, maxFrames, through) {
    let state = launchedState(level, from, abilities, C, startSpec);
    let policyFrame = 0;
    for (let i = 1; i <= maxFrames; i++) {
        state = physicsStep(state, policy(state, ++policyFrame), level, abilities, C);
        if (state.fallen) return null;
        if (state.landedOn && state.landedOn !== from.id
                && !through?.has(state.landedOn)) {
            return state.landedOn;
        }
        // re-landing on `from` (or bouncing through a mover) re-launches
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
        // NOTE: teleport-to-start hosts are terminals too (a landing sends the
        // player home), but that's enforced once per `from` by the
        // reachability builders (buildPlatformGraph / reachableBraidPlatforms),
        // NOT here. canJumpDetailed is the N²-per-graph hot path; a
        // per-(from,to) `level.teleports` probe measurably slowed the column
        // derive (~30%), and it only depends on `from`. See isTeleportHost.
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
    // the launch point can rest up to ~MAX_FALL above the line), and a
    // run that bounces THROUGH pass-through movers gains one more
    // plain rise per TOUCHABLE mover; skip the simulation when `to` is
    // above that. The entrance has no launch: its only gain is the
    // spawn drop itself (none) plus any pass-through bounces.
    const hover = C.LANDING === 'latched' ? C.MAX_FALL : 0;
    const fromLaunch = fromId === ENTRANCE
        ? null : launchTypeFor(level, fromId, abilities);
    const touchable = touchableMovers(
        level, fromY, fromLaunch, C, movingBlues(level, abilities, C));
    const throughGain = touchable.length * (launchRise('bounce', C) + hover);
    if (fromId !== ENTRANCE) {
        const rise = launchRise(fromLaunch, C);
        if (fromY - to.y > rise + hover + throughGain) return fail;
    } else if (fromY - to.y > throughGain) {
        return fail;
    }

    if (C.LANDING === 'latched' && fromId !== ENTRANCE) {
        return latchedCanJump(level, fromId, to, abilities, C, opts);
    }

    // Pass-through movers (minus the target itself — an edge INTO a
    // blue must still end there). Empty/null under classic behaviors.
    let through = passThroughIds(level, abilities, C);
    if (through?.has(toId)) {
        through = new Set(through);
        through.delete(toId);
    }

    // Classic path (and latched ENTRANCE queries — the spawn drop at
    // t = 0 is deterministic, jumpQuery handles it via spawnState).
    const witnesses = [];
    for (const x0 of launchXs(level, fromId, abilities, C, opts)) {
        let witness = null;
        for (const policy of policiesFor(to.x, abilities, C)) {
            const r = jumpQuery(level, fromId, abilities, {
                ...opts, x0, policy: policy.fn, through,
            });
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
/**
 * Column stepping-stone recognizer (dj moving blue). The generator only ever
 * places a blue as a same-x green → blue → green stack: a plain bounce can't
 * clear the doubled gap, but WITH blue the player waits on the lower green for
 * the full-width blue to sweep over the column, lands on it, and bounces
 * straight up — needing NO arrows, at any cycle. (User's tolerance theorem: the
 * blue is wide/slow enough that every column landing is reachable by waiting, so
 * phase is the player's to choose, not an adversarial ∀.) So a STATIC launch
 * from `from` to either the blue itself (CATCH) or the green one gap above it
 * (COMPOSITE) is reachable given blue, with no phase enumeration.
 *
 * Returns true ONLY for that recognized column pattern; every other edge falls
 * through to the exhaustive sim. The fast≡exhaustive corpus test
 * (braidRegime2.slow) forbids a false positive — this can only AGREE with the
 * sim, never invent a verdict.
 */
function columnSteppingStoneReachable(level, from, to, abilities, C) {
    if (C.PLATFORM_BEHAVIORS?.blue !== 'moving' || !from || !abilities.blue) return false;
    // `from` must be a STATIC platform — the tolerance theorem needs the player
    // to WAIT for the blue's phase, which you can't do on a mover. Generator
    // stacks greens here, so this always holds for real stepping stones.
    if (from.type === 'blue' && from.sweep) return false;
    const COL = 2; // px; the column is stacked at one exact x (coherent jitter keeps it aligned)
    const bounce = launchRise('bounce', C); // a plain bounce clears exactly one gap
    const sameCol = (a, b) => Math.abs(a - b) <= COL;
    const oneGapAbove = (lowY, hi) => (lowY - hi.y) > 0 && (lowY - hi.y) <= bounce + 1; // y grows down
    const fullWidthOver = (blue, x) => blue.sweep
        && blue.sweep.min <= x + COL && blue.sweep.max >= x - COL;
    const isMovingBlue = (p) => p.type === 'blue' && p.sweep && isPlatformActive(p, abilities);

    // (1) CATCH: `to` is the column-aligned full-width blue, one gap above `from`.
    if (isMovingBlue(to) && sameCol(to.x, from.x)
            && oneGapAbove(from.y, to) && fullWidthOver(to, from.x)) {
        return true;
    }
    // (2) COMPOSITE: a column-aligned blue sits one gap above `from`, and `to`
    //     (a landable platform at the column) sits one gap above that blue.
    if (sameCol(to.x, from.x) && to.y < from.y) {
        for (const blue of level.platforms) {
            if (!isMovingBlue(blue) || !sameCol(blue.x, from.x)) continue;
            if (oneGapAbove(from.y, blue) && oneGapAbove(blue.y, to)
                    && fullWidthOver(blue, from.x)) {
                return true;
            }
        }
    }
    return false;
}

function latchedCanJump(level, fromId, to, abilities, C, opts) {
    const fail = { ok: false, witnesses: [] };
    const from = platformById(level, fromId);
    // Column stepping-stone fast path (verdict-preserving; see the recognizer).
    // Skipped under exhaustivePhases so that path stays the equivalence oracle.
    if (!opts.exhaustivePhases
            && columnSteppingStoneReachable(level, from, to, abilities, C)) {
        return { ok: true, witnesses: [{ x0: 0, hover: 0, t0: 0, policy: 'column-stone' }] };
    }
    const maxFrames = opts.maxFrames ?? 600;
    const targetX = to.sweep ? (to.sweep.min + to.sweep.max) / 2 : to.x;
    const policies = policiesFor(targetX, abilities, C);
    let through = passThroughIds(level, abilities, C);
    if (through?.has(to.id)) {
        through = new Set(through);
        through.delete(to.id);
    }

    const halfSpan = C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
    const x0Step = opts.x0Step ?? halfSpan / 2;
    const rels = [];
    for (let r = -halfSpan; r <= halfSpan + 1e-9; r += x0Step) rels.push(r);
    // Hover heights (route-dependent rest point above the line). Not
    // an interval analysis: a sub-sample-width interception window can
    // escape — the generator's overshoot margins keep those away.
    const hovers = [0, 7.3, 14.7, Math.max(0, C.MAX_FALL - 0.05)];

    const movers = movingBlues(level, abilities, C);
    const fromMoving = movers.some((p) => p.id === fromId);
    // Phase only enters `step` through mover catch tests, so only the
    // movers this run can TOUCH matter — an edge that can't reach any
    // mover band is identical at every phase (one phase suffices).
    const relevant = fromMoving ? movers : touchableMovers(
        level, from.y, launchTypeFor(level, fromId, abilities), C, movers);
    const L = phaseLcm(relevant, C);

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
        const window = C.PLATFORM_WIDTH + 2 * C.PLAYER_HALF_WIDTH;
        if (relevant.length === 1 && cycle > 0
                && C.BLUE_SPEED * cycle <= window && !opts.exhaustivePhases) {
            // ALIGNED-STRIDE FAST PATH (the tolerance theorem): while
            // waiting on this static platform, catch opportunities come
            // every `cycle` ticks and the mover travels at most
            // BLUE_SPEED*cycle arc-px between them. Unfolding the
            // triangle sweep to a circle, the positions sampled within
            // ANY residue class form an arithmetic orbit with step
            // gcd(BLUE_SPEED*cycle, 2*span) ≤ BLUE_SPEED*cycle, so when
            // that step fits inside the catch window (width 60+46=106)
            // the orbit cannot skip over it: EVERY alignment is
            // reachable in EVERY class, and the player's x is preserved
            // through the landing, so a witness at one sampled phase
            // implies witnesses in all classes. We therefore test ONE
            // group of phases sampled at a stride that shifts the
            // mover's schedule by at most half the window
            // (BLUE_SPEED * stride ≤ window/2) — every claim is still
            // backed by a real simulated trajectory.
            const stride = Math.max(1, Math.floor(window / (2 * C.BLUE_SPEED)));
            const group = [];
            for (let t = 0; t < L; t += stride) group.push(t);
            phaseGroups = [group];
        } else {
            const g = cycle > 0 ? gcd(cycle, L) : L;
            phaseGroups = Array.from({ length: g }, (_, r) => {
                const group = [];
                for (let t = r; t < L; t += g) group.push(t);
                return group;
            });
        }
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
                            { rel, hover, t0 }, policy.fn, maxFrames, through,
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
    // Teleport-to-start hosts are TERMINALS — a landing sends the player home,
    // so they get no climb edges. Skipping them once per from-node (cheap)
    // keeps the per-(from,to) canJump hot path clean (see canJumpDetailed).
    const teleportHosts = new Set((level.teleports ?? []).map((t) => t.on));
    // terminalPortals (gated braid): a portal host is terminal too — you exit /
    // bounce off, you never climb on. Off by default so the bot's normal graph
    // (which DOES climb past a locked portal) is unchanged; the gated-braid
    // verifier opts in so an offset portal tip can't leak a skip route.
    const portalHosts = (opts.terminalPortals && level.portals)
        ? new Set(level.portals.map((pt) => pt.on)) : null;
    for (const from of nodes) {
        if (teleportHosts.has(from) || portalHosts?.has(from)) continue;
        for (const p of platforms) {
            if (p.id === from) continue;
            if (canJump(level, from, p.id, abilities, opts)) {
                edges.get(from).add(p.id);
            }
        }
    }
    // ...and a teleport host's ONLY outgoing edge is back to the ENTRANCE: the
    // bot can deliberately path to one to return home (replacing the old "fall
    // off the level" descend). Guarded by activity (a suppressed host has no
    // node).
    for (const host of teleportHosts) {
        if (edges.has(host)) edges.get(host).add(ENTRANCE);
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

/**
 * Row-aware reachability for BRAID levels — a layered shortcut to
 * `reachablePlatforms(buildPlatformGraph(...))` that exploits the braid's
 * geometry instead of building the full N² edge graph.
 *
 * A braid is built strictly row by row (generator.proposeBraidLevel): every
 * platform in one row shares a `y`, each row sits exactly one launch-gap above
 * the previous, and the ONLY real edges go from a row to the row immediately
 * above it (forks place both branches at the next y; gaps are sized so one
 * launch clears exactly one gap). Edges within a row or down a row are
 * physically possible in spots but REDUNDANT for entrance reachability — every
 * platform is already reached climbing up (forks make both lanes reachable
 * from their shared parent; merges reach the merged lane). So flooding only
 * the adjacent-row edges yields the SAME reachable set as the full graph, at
 * ~2N `canJump` calls instead of N².
 *
 * Layered sweep, bottom (max y) → top: the entrance launches into the bottom
 * row; each reached row launches into the next. `goalHosts` (portal/pickup
 * host ids) lets the sweep early-exit the moment every goal is reached.
 *
 * Ability-parametric (takes whatever `abilities` it's given) so the same
 * primitive serves Regime 1 (full inventory) and Regime 2 (gated subsets).
 * Mirrors `reachablePlatforms`' contract: returns the Set of reached platform
 * ids (ENTRANCE excluded).
 */
export function reachableBraidPlatforms(level, abilities, opts = {}) {
    const { goalHosts, ...queryOpts } = opts;
    const C = queryOpts.constants ?? DEFAULTS;
    const platforms = activePlatforms(level, abilities);
    const byY = new Map();
    for (const p of platforms) {
        const row = byY.get(p.y);
        if (row) row.push(p); else byY.set(p.y, [p]);
    }
    const ys = [...byY.keys()].sort((a, b) => b - a); // bottom (largest y) first
    const rows = ys.map((y) => byY.get(y)); // index 0 = bottom row

    // A row is "pass-through" if it holds a moving blue: a launch from BELOW
    // it can bounce THROUGH to a platform ABOVE (canJump auto-passes-through
    // movers — see the phase-machinery header), a skip-row edge the strict
    // adjacent sweep would miss. Such a row stays transparent even when its
    // own platform isn't a reachable landing (you pass through without landing).
    const moverIds = new Set(movingBlues(level, abilities, C).map((p) => p.id));
    const passThrough = rows.map((row) => row.some((p) => moverIds.has(p.id)));
    // Teleport-to-start hosts are landable but TERMINAL: they can be reached
    // (and be a goal), but never LAUNCH — a landing sends the player home. So
    // they're excluded from the launcher set (the row-aware analog of the
    // graph skipping their out-edges). Cheap once-per-host set.
    const teleportHosts = new Set((level.teleports ?? []).map((t) => t.on));
    // terminalPortals (gated braid only): a portal host is terminal too — you
    // exit through an open portal, or bounce off a locked one; you never climb
    // ON from it. Excluding it from launchers stops an OFFSET portal tip from
    // leaking a skip route around a gate (the straight bypass carries the
    // climb). Off by default, so Regime-1 / fork braids are unaffected.
    const portalHosts = (opts.terminalPortals && level.portals)
        ? new Set(level.portals.map((pt) => pt.on)) : null;
    const isTerminal = (id) => teleportHosts.has(id) || (portalHosts?.has(id) ?? false);

    const reached = new Set();
    const remaining = goalHosts ? new Set(goalHosts) : null;
    // Bottom → top single pass (skip edges only point upward, so every row's
    // launchers are already finalised below it). Launchers for row i: the
    // reached platforms in row i-1 (minus terminal hosts), walking further
    // down through any pass-through rows; the entrance seeds the bottom row.
    for (let i = 0; i < rows.length; i++) {
        const launchers = i === 0 ? [ENTRANCE] : [];
        for (let j = i - 1; j >= 0; j--) {
            for (const p of rows[j]) {
                if (reached.has(p.id) && !isTerminal(p.id)) launchers.push(p.id);
            }
            if (!passThrough[j]) break; // opaque row stops the skip-through
        }
        // Try STATIC launchers before moving ones. A mover (blue) launcher forces
        // the expensive from-moving ∀-phase canJump, but a blue is only ever a
        // green→blue→green column stepping-stone: the green ABOVE it is already
        // reached from the green BELOW via the O(1) composite recognizer
        // (columnSteppingStoneReachable), so the blue-as-launcher edge is
        // redundant and need never be evaluated when a static launcher succeeds
        // first. The reachable set is the union over launchers (order-independent),
        // so this only saves work — it never changes a verdict. Stable sort keeps
        // the closest-row-first order within each group.
        launchers.sort((a, b) => (moverIds.has(a) ? 1 : 0) - (moverIds.has(b) ? 1 : 0));
        for (const p of rows[i]) {
            for (const from of launchers) {
                if (canJump(level, from, p.id, abilities, queryOpts)) {
                    reached.add(p.id);
                    remaining?.delete(p.id);
                    break;
                }
            }
        }
        if (remaining && remaining.size === 0) break; // every goal reached
    }
    return reached;
}
