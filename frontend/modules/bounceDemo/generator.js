/**
 * Bounce Demo level generator
 * (docs/json/developer/procgen/bounce.md).
 *
 * Generate-and-test (Cloudberry-style): `generateLevel` PROPOSES a
 * platform arrangement for a target requirement ("this level needs
 * ability set S") and VERIFIES it with the same derive-rules verifier
 * the pipeline uses — every pickup and the top exit must derive
 * minimal sets of exactly [S], with no defects. Failed proposals are
 * retried with a perturbed seed; geometry is stored explicitly (the
 * no-RNG-determinism principle: the seed only drives generation,
 * nothing at runtime replays it).
 *
 * Construction is a vertical climb from the entrance column with one
 * GATE SEGMENT per required ability, separated by plain bounce steps:
 *   springs  — a 380-440px gap above a spring (plain apex 169 fails,
 *              spring apex 484 clears; overshoot < 120 so the next
 *              step is never intercepted)
 *   jetpacks — a 1180-1240px gap above a jetpack (spring 484 fails,
 *              jetpack apex 1296 clears; overshoot <= 116 < 120)
 *   blue/brown — a colored stepping stone mid-gap (240px total: plain
 *              bounce can't skip it; with the item it's two 120 steps)
 *   left/right — a 140px column shift (catch span is 42px, so the
 *              matching arrow is required; column tracking keeps the
 *              shift inside the walls)
 * Pickups land on dedicated platforms after all gates; the exit
 * platform tops the climb. Plain steps jitter around the column
 * NON-cumulatively (a no-arrows player's x never moves, so the column
 * itself must stay fixed between arrow gates).
 *
 * `generateZoneSet` builds a whole winnable zone table for the
 * substrate factory: zone 0 grants both arrows with no requirement
 * (side exits derive arrow gates, and a no-arrows player exits at the
 * first exit platform on the forced path), each later non-filler zone
 * requires a subset of already-granted abilities and grants the next
 * item, fillers grant nothing, and the final zone's pickup is Victory.
 */

import { createRng } from '../shared/rng.js';
import { DEFAULTS, PROFILES, launchRise, step } from './physics.js';
import { deriveAccessRules, deriveBraidAccessRules } from './deriveRules.js';
import { reachableBraidPlatforms } from './canJump.js';
import { validateLevel, braidBlueInvariantErrors } from './level.js';
import {
    ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME, BOUNCE_OBSTACLE_ID_BY_ABILITY,
} from './apRules.js';

// ── Profile geometry ─────────────────────────────────────────────────
//
// The generator's spacing is a function of the physics constants (a
// gate gap only gates if the failing launch's apex can't clear it), so
// each physics profile carries its own geometry. Two kinds of value:
//
//  - APEX-DERIVED (PLAIN_DY, the spring/jetpack gap windows):
//    deriveGeometry computes them from C via apex = vy^2 / 2g.
//  - SWEEP-CALIBRATED (BRANCH_DX, ARROW_HALF_WIDTH_FLOOR): empirical —
//    the width floor comes from the wrapAsymmetry sweep (single-arrow
//    gating collapses under screen wrap below ~600px width for
//    classic). deriveGeometry copies classic's values as placeholders;
//    recalibrate with a wrapAsymmetry-style sweep when a profile's
//    constants land.
//
// EXPERIMENTAL_GEOMETRY is PINNED to the legacy literals (not derived) so
// committed presets reproduce byte-identically; validateGeometry
// asserts the structural constraints both pinned and derived values
// must satisfy, and the generate-verify loop remains the gatekeeper
// either way.

export const EXPERIMENTAL_GEOMETRY = Object.freeze({
    WIDTH: 400,          // single-target (legacy zone-set) level width
    // Multi-target levels are a FIXED width (user decision 2026-06-11,
    // applied to classic after the dj fix): the wrap point and the
    // renderer's zoom never depend on platform placement. 700 is the
    // smallest width that fits classic's worst column extent — the
    // column wanders ±BRANCH_DX (140) through arrow gates and tips
    // hang another ±140 beyond, so max |x| = 280, plus the 70px
    // placement margin = a 350px half-span. Wider than the 600px
    // arrow-gating floor, so wrap gating only gets safer. NOTE this
    // moved the frozen-classic artifact baseline —
    // bounce_sphere_worldgen and bounce_mixed_worldgen presets were
    // regenerated (the verify loop re-derived all rules).
    WIDTH_MODE: 'fixed',
    FIXED_WIDTH: 700,
    PLAIN_DY: 120,       // plain bounce step (apex 169 clears with margin)
    SPRING_GAP: Object.freeze({ min: 380, span: 60 }),   // plain 169 fails, spring 484 clears
    JETPACK_GAP: Object.freeze({ min: 1180, span: 60 }), // spring 484 fails, jetpack 1296 clears
    BRANCH_DX: 140,      // arrow-gate column shift / branch-tip offset
    ARROW_HALF_WIDTH_FLOOR: 300, // 600px width floor for arrow-gated goals (wrap sweep)
});

/** Worst-case extra launch height above the platform LINE: latched
 *  landings rest at a hover point up to ~MAX_FALL above the line
 *  (no-snap lookahead catch); immediate landings snap to the line. */
const hoverMax = (C) => (C.LANDING === 'latched' ? C.MAX_FALL : 0);

/**
 * Derive a profile's generator geometry from its physics constants.
 * Used for profiles without pinned geometry; classic stays pinned.
 * Rises come from physics.launchRise — the TRUE discrete rise measured
 * by running `step` (the closed form vy^2/2g misses discrete effects:
 * classic plain is 162.5, not 169; dj-latched plain is 114.4).
 * `base` supplies the sweep-calibrated values.
 */
export function deriveGeometry(C, base = EXPERIMENTAL_GEOMETRY) {
    const floor10 = (v) => Math.floor(v / 10) * 10;
    const round10 = (v) => Math.round(v / 10) * 10;
    const plainRise = launchRise('bounce', C);
    const fudge = hoverMax(C);
    // A comfortable plain step: ~75% of the guaranteed plain rise
    // (classic: 120 of 162.5). A gate window's min is bounded BELOW by
    // interception (overshoot clearRise + hover - min must stay under
    // one plain step) and by unclearability (above the weaker launch's
    // best hover), and bounded ABOVE by clearability from the line
    // (min + span < clearRise). The midpoint of that range — which
    // reproduces classic's pinned 380/1180 exactly — leaves margin on
    // both sides; validateGeometry rejects infeasible combinations.
    const PLAIN_DY = round10(plainRise * 0.75);
    const span = 60;
    const gateWindow = (clearRise, failRise) => {
        const lower = Math.max(clearRise + fudge - PLAIN_DY, failRise + fudge);
        const upper = clearRise - span;
        const mid = (lower + upper) / 2;
        // prefer a 10-aligned min; tight ranges (huge rises leave only
        // a sliver between interception and clearability) fall back to
        // the integer midpoint
        let min = floor10(mid);
        if (min <= lower) min = Math.floor(mid);
        return Object.freeze({ min, span });
    };
    const springRise = launchRise('spring', C);
    return Object.freeze({
        WIDTH: base.WIDTH,
        PLAIN_DY,
        SPRING_GAP: gateWindow(springRise, plainRise),
        JETPACK_GAP: gateWindow(launchRise('jetpack', C), springRise),
        BRANCH_DX: base.BRANCH_DX,
        ARROW_HALF_WIDTH_FLOOR: base.ARROW_HALF_WIDTH_FLOOR,
    });
}

/**
 * Structural constraints geometry must satisfy under its constants —
 * checked for pinned and derived geometry alike (tests); returns a
 * list of violation strings, empty = valid. Gates must be unclearable
 * by the weaker launch even from its highest hover point
 * (rise + hoverMax), and clearable by the stronger one from the LINE
 * (rise alone — the guaranteed minimum).
 */
export function validateGeometry(G, C) {
    const errors = [];
    const plainRise = launchRise('bounce', C);
    const springRise = launchRise('spring', C);
    const jetRise = launchRise('jetpack', C);
    const fudge = hoverMax(C);
    if (G.PLAIN_DY >= plainRise) {
        errors.push(`PLAIN_DY ${G.PLAIN_DY} not clearable (plain rise ${plainRise})`);
    }
    const checkWindow = (name, w, clearRise, failRise) => {
        if (w.min <= failRise + fudge) {
            errors.push(`${name} min ${w.min} clearable by the failing launch `
                + `(rise ${failRise} + hover ${fudge})`);
        }
        if (w.min + w.span >= clearRise) {
            errors.push(`${name} max ${w.min + w.span} not clearable (rise ${clearRise})`);
        }
        if (clearRise + fudge - w.min >= G.PLAIN_DY) {
            errors.push(`${name} overshoot ${clearRise + fudge - w.min} >= PLAIN_DY ${G.PLAIN_DY}`
                + ' (next rung intercepted)');
        }
    };
    checkWindow('SPRING_GAP', G.SPRING_GAP, springRise, plainRise);
    checkWindow('JETPACK_GAP', G.JETPACK_GAP, jetRise, springRise);
    const catchSpan = C.PLATFORM_WIDTH + 2 * C.PLAYER_HALF_WIDTH;
    if (G.BRANCH_DX <= catchSpan) {
        errors.push(`BRANCH_DX ${G.BRANCH_DX} within the catch span ${catchSpan}`
            + ' (branch tip reachable without drift)');
    }
    return errors;
}

/**
 * dj geometry, PINNED from deriveGeometry(PROFILES.dj.constants) plus
 * the flat-control sweep results (canJump.test.js "dj branch tips"):
 * flat ±10 px/tick covers ~120px of drift within a plain-bounce
 * flight, and the tip must clear both the 106px catch envelope
 * (2 * 53, no-cheese margin) and the 113px interception clearance
 * (width 60 + half-span 53, branch placement) — 115 is the first
 * placeable value, still inside the verified flat-control range
 * (∀-launch-offset witnesses confirmed at 115 and 120). The jetpack
 * window rides the sustained-thrust rise (6250px): dj jetpack gates
 * make TALL levels.
 */
export const DJ_GEOMETRY = Object.freeze({
    // FIXED width (user requirement, 2026-06-11 browser test): the
    // wrap point and the renderer's zoom must not depend on platform
    // placement — every dj level is exactly this wide, like DJ's
    // fixed 240px stage. 600 = the arrow-gating floor (one flat-
    // control flight can't cross the wrap seam from the column).
    WIDTH: 600,
    WIDTH_MODE: 'fixed',
    PLAIN_DY: 90,
    SPRING_GAP: Object.freeze({ min: 480, span: 60 }),
    JETPACK_GAP: Object.freeze({ min: 6186, span: 60 }),
    BRANCH_DX: 115,
    ARROW_HALF_WIDTH_FLOOR: 300,
});

// Per-profile pinned geometry, keyed by profile id; profiles absent here derive
// from their constants.
const GEOMETRIES = Object.freeze({ experimental: EXPERIMENTAL_GEOMETRY, dj: DJ_GEOMETRY });

/**
 * Resolve a generator `physics` option to { profileId, C, G }.
 * Accepts a profile id (default 'experimental') or an explicit
 * { constants, geometry } object (tests, future custom profiles).
 */
export function resolveGenPhysics(physics) {
    if (!physics || physics === 'experimental') {
        return { profileId: 'experimental', C: DEFAULTS, G: EXPERIMENTAL_GEOMETRY };
    }
    if (typeof physics === 'string') {
        const profile = PROFILES[physics];
        if (!profile) throw new Error(`bounce generator: unknown physics profile '${physics}'`);
        const C = profile.constants;
        return { profileId: physics, C, G: GEOMETRIES[physics] ?? deriveGeometry(C) };
    }
    const C = physics.constants ?? DEFAULTS;
    return {
        profileId: physics.profile ?? null,
        C,
        G: physics.geometry ?? deriveGeometry(C),
    };
}

function sameSets(minimalSets, want) {
    if (minimalSets.length !== 1) return false;
    const got = minimalSets[0];
    return got.length === want.length && want.every((a) => got.includes(a));
}

// ── Obstacle primitives ─────────────────────────────────────────────
//
// One GEOMETRY TEMPLATE per ability gap. Each primitive is keyed by its ability and carries the
// shared obstacle id (BOUNCE_OBSTACLE_ID_BY_ABILITY) so the obstacle id is
// the single through-line: this template's geometry is what the verifier
// proves gates the ability, and what the emitter records as the path's
// obstacle. `buildSteps(rng, G)` returns the climb steps the gate injects
// — the exact geometry (and rng draw order) the old gateSteps switch
// produced, so byte-identity holds.
//
//   springs  — a 380-440px gap above a spring (plain apex fails, spring
//              clears; one rng draw for the gap height)
//   jetpacks — a 1180-1240px gap above a jetpack (spring fails, jetpack
//              clears; one rng draw)
//   blue/brown — a colored stepping stone mid-gap (two plain steps, no
//              rng: plain bounce can't skip it, the item splits it)
//   left/right — a ±BRANCH_DX column shift (catch span < shift, so the
//              matching arrow is required; no rng)
export const OBSTACLE_PRIMITIVES = Object.freeze({
    springs: {
        obstacleId: BOUNCE_OBSTACLE_ID_BY_ABILITY.springs,
        buildSteps: (rng, G) => [
            { dy: G.SPRING_GAP.min + rng.next() * G.SPRING_GAP.span, spring: true }],
    },
    jetpacks: {
        obstacleId: BOUNCE_OBSTACLE_ID_BY_ABILITY.jetpacks,
        buildSteps: (rng, G) => [
            { dy: G.JETPACK_GAP.min + rng.next() * G.JETPACK_GAP.span, jetpack: true }],
    },
    blue: {
        obstacleId: BOUNCE_OBSTACLE_ID_BY_ABILITY.blue,
        buildSteps: (rng, G) => [{ dy: G.PLAIN_DY, type: 'blue' }, { dy: G.PLAIN_DY }],
    },
    brown: {
        obstacleId: BOUNCE_OBSTACLE_ID_BY_ABILITY.brown,
        buildSteps: (rng, G) => [{ dy: G.PLAIN_DY, type: 'brown' }, { dy: G.PLAIN_DY }],
    },
    left: {
        obstacleId: BOUNCE_OBSTACLE_ID_BY_ABILITY.left,
        buildSteps: (rng, G) => [{ dy: G.PLAIN_DY, dx: -G.BRANCH_DX }],
    },
    right: {
        obstacleId: BOUNCE_OBSTACLE_ID_BY_ABILITY.right,
        buildSteps: (rng, G) => [{ dy: G.PLAIN_DY, dx: +G.BRANCH_DX }],
    },
});

/** Gate-segment steps for one ability — the obstacle primitive's geometry
 *  template instantiated (shared by both proposal paths). */
function gateSteps(ability, rng, G) {
    const primitive = OBSTACLE_PRIMITIVES[ability];
    if (!primitive) throw new Error(`generateLevel: no gate builder for '${ability}'`);
    return primitive.buildSteps(rng, G);
}

/** One proposal. Returns a level (bottom margin/height computed last). */
function proposeLevel({ id, requirement, pickupCount, rng, stepsBetween, jitter = 0, G }) {
    const WIDTH = G.WIDTH;
    const COLUMN = WIDTH / 2;
    const PLAIN_DY = G.PLAIN_DY;
    // steps grow upward as deltas; realized into platforms afterwards.
    // Plain-step x-jitter (opts.jitter, px amplitude) DEFAULTS TO 0: a
    // no-arrows player's x never changes, so an arrowless chain must
    // be exactly aligned — ANY jitter delta fails the solver's
    // ∀-launch-position check (the span-edge launch can't correct).
    // One held arrow only corrects one direction, so single-arrow
    // requirements fail too. Jitter only verifies when the requirement
    // includes BOTH arrows; the verify loop is the gatekeeper either
    // way — a jittered proposal that fails verification is rejected,
    // never emitted.
    const steps = [];
    const plains = () => {
        const n = 1 + Math.floor(rng.next() * stepsBetween);
        for (let i = 0; i < n; i++) steps.push({ dy: PLAIN_DY, jitter: true });
    };

    const gates = rng.shuffle([...requirement]);
    for (const ability of gates) {
        plains();
        steps.push(...gateSteps(ability, rng, G));
    }
    plains();
    for (let i = 0; i < pickupCount; i++) steps.push({ dy: PLAIN_DY, pickup: true });
    steps.push({ dy: PLAIN_DY, exit: true });

    // realize: walk the steps upward from the entrance platform
    const totalRise = steps.reduce((sum, s) => sum + s.dy, 0);
    const height = Math.ceil(totalRise + 220);
    const platforms = [];
    const springs = [];
    const jetpacks = [];
    const pickups = [];
    const portals = [];
    let x = COLUMN;
    let y = height - 100;
    let n = 0;
    let pickupN = 0;
    const place = (px, py, type = 'green') => {
        const platform = { id: `p${n++}`, x: px, y: py, type };
        platforms.push(platform);
        return platform;
    };
    let prev = place(x, y); // entrance platform under the spawn column
    for (const s of steps) {
        if (s.spring) springs.push({ id: `s${n}`, x: prev.x, y: prev.y - 5, on: prev.id });
        if (s.jetpack) jetpacks.push({ id: `j${n}`, x: prev.x, y: prev.y - 5, on: prev.id });
        x += s.dx ?? 0;
        y -= s.dy;
        // non-cumulative: jitter offsets the platform, not the column
        const dx = (s.jitter && jitter > 0) ? (rng.next() - 0.5) * 2 * jitter : 0;
        prev = place(x + dx, y, s.type ?? 'green');
        if (s.pickup) {
            pickups.push({ id: `loc_${pickupN++}`, x: prev.x, y: prev.y - 20, on: prev.id });
        }
        if (s.exit) {
            portals.push({
                id: 'exit_up', x: prev.x, y: prev.y - 20, on: prev.id,
                target_region: null, direction: 'up',
            });
        }
    }
    return {
        id, size: { width: WIDTH, height },
        platforms, springs, jetpacks, pickups, portals,
    };
}

/**
 * Generate one level whose pickups and top exit require EXACTLY
 * `requirement` (an ability-name array). Throws if no proposal
 * verifies within `attempts`.
 */
export function generateLevel({
    id,
    requirement = [],
    pickupCount = 1,
    stepsBetween = 2,
    seed = 1,
    attempts = 8,
    jitter = 0,
    physics = 'experimental',
} = {}) {
    const { C, G } = resolveGenPhysics(physics);
    const want = [...requirement].sort();
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        const level = proposeLevel({ id, requirement, pickupCount, rng, stepsBetween, jitter, G });
        const modelErrors = validateLevel(level);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveAccessRules(level, { constants: C });
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const goals = [
            ...level.pickups.map((pk) => derived.pickups[pk.id]),
            derived.exits.exit_up,
        ];
        if (goals.every((g) => sameSets(g.minimalSets, want))) return level;
        rejected.push(`attempt ${attempt}: derived rules != [${want.join('+')}]`);
    }
    throw new Error(`generateLevel('${id}'): no valid proposal in ${attempts} attempts`
        + ` (requirement [${want.join('+')}]): ${rejected.join('; ')}`);
}

/**
 * Generate a complete winnable zone table (ZONES shape: [{level,
 * items}]) for createBounceSubstrateEntry. `count` >= 6: zone 0
 * (two-arrow starter) + 4 feature zones + the Victory zone; anything
 * beyond is filler.
 *
 * `jitter` (px): when > 0, every non-starter zone adds BOTH arrows to
 * its requirement — jitter only verifies under two-way correction, and
 * the arrows are granted in zone 0, so the set stays winnable. The
 * starter stays exactly aligned (it must be playable with nothing).
 */
export function generateZoneSet({ count = 7, seed = 1, jitter = 0 } = {}) {
    if (count < 6) throw new Error('generateZoneSet: count must be >= 6');
    const rng = createRng(seed);
    const featureGrants = rng.shuffle(['springs', 'blue', 'brown', 'jetpacks']);
    const fillerCount = count - 6;

    // zone plans: starter, features (+fillers interleaved), victory
    const plans = [{ requirement: [], grants: ['right', 'left'] }];
    const middle = featureGrants.map((g) => ({ grants: [g] }));
    for (let i = 0; i < fillerCount; i++) {
        middle.splice(1 + Math.floor(rng.next() * middle.length), 0, { filler: true });
    }
    plans.push(...middle, { victory: true });

    const granted = [];
    const zones = [];
    plans.forEach((plan, i) => {
        const isStarter = i === 0;
        let requirement = [];
        if (!isStarter && !plan.filler) {
            // require 1-2 already-granted abilities (features preferred)
            const pool = granted.filter((a) => a !== 'left' && a !== 'right');
            const pick = (from) => from[Math.floor(rng.next() * from.length)];
            requirement = [pick(pool.length ? pool : granted)];
            if (rng.next() < 0.5) {
                const more = granted.filter((a) => !requirement.includes(a));
                if (more.length) requirement.push(pick(more));
            }
        }
        if (jitter > 0 && !isStarter) {
            for (const arrow of ['left', 'right']) {
                if (!requirement.includes(arrow)) requirement.push(arrow);
            }
        }
        const grants = plan.victory ? [] : (plan.grants ?? []);
        const pickupCount = plan.victory ? 1 : grants.length;
        const level = generateLevel({
            id: `gen_z${i}`,
            requirement,
            pickupCount: plan.filler ? 0 : pickupCount,
            seed: (seed * 31 + i) | 0,
            jitter: isStarter ? 0 : jitter,
        });
        const items = {};
        level.pickups.forEach((pk, idx) => {
            items[pk.id] = plan.victory
                ? VICTORY_ITEM_NAME
                : ABILITY_ITEM_NAMES[grants[idx]];
        });
        granted.push(...grants);
        zones.push({ level, items });
    });
    return zones;
}

// ── Multi-target generation (sphere-driven growth, step 2) ──────────
//
// generateLevelFromSpecs targets SEVERAL goals with DIFFERENT
// requirements in one level — the prefix-graded chain: the
// climb realises the nested requirement chain as gate segments, each
// goal attaches at its rung, and a goal's derived rule is the prefix
// of gates below it (plus its own drift arrow, for branch exits).
//
// Goal placement semantics (portals are LANDING-triggered, so an
// on-column portal swallows every climb that reaches it):
//
// - PICKUPS sit on column rungs at their requirement's segment.
//   Landing collects without teleporting, so any number stack up.
// - ARROW-GATED EXITS (requirement contains left/right) become
//   BRANCH TIPS: a platform hanging ±140px off the column at their
//   segment — the same geometry as an arrow gate, so the drift jump
//   itself demands the arrow while the column below demands the rest
//   of the requirement. Off-column means the climb never lands on
//   them accidentally.
// - An ARROWLESS-GATED EXIT (requirement without arrows, e.g. [] or
//   ['springs']) is only reachable on the forced column, so it must
//   be the on-column TOP — which blocks everything above. Hence: at
//   most ONE arrowless exit per level, its requirement must contain
//   every other goal's, and any larger arrow exit may exceed it by
//   exactly its drift arrow. Callers (the sphere grower) compose
//   exit gates around this — the thrown spec errors are the
//   "adapter declines" channel.
//
// Levels get a DYNAMIC symmetric width (the spawn column stays at
// width/2, which physics.spawnState and wall clamping key on), so
// branch tips and column shifts never collide with walls.

const ARROW_ABILITIES = ['left', 'right'];
const KNOWN_ABILITIES = new Set(['springs', 'jetpacks', 'blue', 'brown', 'left', 'right']);

const reqKey = (req) => req.join('+');
const hasArrow = (req) => req.some((a) => ARROW_ABILITIES.includes(a));
const isSubsetReq = (a, b) => a.every((x) => b.includes(x));

// ── Brown-as-host mode (dj platform behaviors) ──────────────────────
//
// Under dj behaviors BROWN cannot be a column-core stepping stone: a
// breaking brown has no outgoing edges (the weak bounce depends on
// arrival speed), so brown in a goal's requirement is realized on the
// GOAL'S OWN host platform instead of as a gate segment below it:
//
//  - arrow + brown exit  → branch tip whose host platform is brown
//    (the drift supplies steering).
//  - arrowless brown goal → the unique column-TOP slot (climbing past
//    a brown host is impossible: suppressed = a 2x gap, present = no
//    outgoing edges). At most ONE per level, its requirement must be
//    the column ceiling, and it cannot coexist with an (uncolored)
//    arrowless top exit. Brown pickups with arrows are declined in v1
//    (pickups have no tip machinery).
//
// BLUE stays a stepping-stone gate in BOTH profiles — under dj the
// stone gets a full-width sweep, and the solver's pass-through edges
// verify the wait-on-the-green / land / bounce-straight-off maneuver
// (the player's x is preserved through the landing, so the onward
// launch happens from the column, not from the sweep extremes).
// Classic behaviors keep all colored stepping-stone gates unchanged.
const colorHostMode = (C) => C.PLATFORM_BEHAVIORS?.brown === 'breaking';
// Moving blues sweep the FULL level width (like DJ: centers 15..195
// of the 240 stage) — the sweep bounds are level data assigned after
// width normalization, with this center-margin at each edge.
const BLUE_SWEEP_EDGE_MARGIN = 15;

function normalizeRequirement(req, what) {
    const norm = [...new Set(req ?? [])].sort();
    for (const a of norm) {
        if (!KNOWN_ABILITIES.has(a)) {
            throw new Error(`generateLevelFromSpecs: ${what} requires unknown ability '${a}'`);
        }
    }
    return norm;
}

/**
 * Normalize + validate spec goals. Throws on spec-level errors (these
 * are non-retryable: no proposal can satisfy them). Returns
 * { exits, pickups, arrowFree, ceiling } with sorted requirements.
 */
function normalizeSpecGoals(exitSpecs, pickupSpecs, colorHost = false) {
    if (!Array.isArray(exitSpecs) || exitSpecs.length === 0) {
        throw new Error('generateLevelFromSpecs: at least one exit spec required');
    }
    const seenIds = new Set();
    const takeId = (id, what) => {
        if (!id) throw new Error(`generateLevelFromSpecs: ${what} without id`);
        if (seenIds.has(id)) throw new Error(`generateLevelFromSpecs: duplicate goal id '${id}'`);
        seenIds.add(id);
        return id;
    };
    const exits = exitSpecs.map((s) => ({
        id: takeId(s.id, 'exit spec'),
        req: normalizeRequirement(s.requirement, `exit '${s.id}'`),
        direction: s.direction ?? null,
    }));
    const pickups = (pickupSpecs ?? []).map((s) => ({
        id: takeId(s.id, 'pickup spec'),
        req: normalizeRequirement(s.requirement, `pickup '${s.id}'`),
    }));

    if (colorHost) {
        // dj behaviors: brown rides the goal's host platform (see the
        // brown-as-host header); blue stays a stepping-stone gate.
        for (const g of [...exits, ...pickups]) {
            g.hostColor = g.req.includes('brown') ? 'brown' : null;
        }
        const coloredArrowless = [...exits, ...pickups]
            .filter((g) => g.hostColor && !hasArrow(g.req));
        if (coloredArrowless.length > 1) {
            throw new Error('generateLevelFromSpecs: at most one arrowless brown goal per '
                + `level under dj behaviors (got ${coloredArrowless.map((g) => `'${g.id}'`).join(', ')})`);
        }
        for (const pk of pickups) {
            if (pk.hostColor && hasArrow(pk.req)) {
                throw new Error(`generateLevelFromSpecs: pickup '${pk.id}' combines brown `
                    + 'with an arrow — brown tip pickups are not supported (dj behaviors)');
            }
        }
    }

    const arrowlessExits = exits.filter((e) => !hasArrow(e.req));
    if (arrowlessExits.length > 1) {
        throw new Error('generateLevelFromSpecs: at most one arrowless-gated exit per level'
            + ` (got ${arrowlessExits.map((e) => `'${e.id}'`).join(', ')})`);
    }
    const arrowFree = arrowlessExits[0] ?? null;

    // COLUMN goals (pickups + the arrowless top exit) need their full
    // requirements realised as gates below them, so those must form a
    // ⊆-chain — the v1 prefix-graded constraint. Branch exits are
    // looser: each needs only its ATTACH KEY (requirement minus its
    // drift arrow) on the column; the drift supplies the arrow. The
    // attach keys are chosen greedily here so {left} and {springs}
    // exits can coexist (both attach low, different drifts/keys).
    const columnKeys = [...pickups.map((p) => p.req)];
    if (arrowFree) columnKeys.push(arrowFree.req);
    const nests = (keys) => {
        const sorted = [...keys].sort((a, b) => a.length - b.length);
        for (let i = 1; i < sorted.length; i++) {
            if (!isSubsetReq(sorted[i - 1], sorted[i])) return [sorted[i - 1], sorted[i]];
        }
        return null;
    };
    {
        const clash = nests(columnKeys);
        if (clash) {
            throw new Error('generateLevelFromSpecs: column-goal requirements must form a '
                + `nested chain — [${clash[0].join(',')}] vs [${clash[1].join(',')}]`);
        }
    }
    if (arrowFree) {
        // The arrowless exit's rung is the column TOP: nothing on the
        // column may need gates beyond it.
        for (const pk of pickups) {
            if (!isSubsetReq(pk.req, arrowFree.req)) {
                throw new Error(`generateLevelFromSpecs: pickup '${pk.id}' requires more than `
                    + `the arrowless exit '${arrowFree.id}' — it would sit above the top portal`);
            }
        }
    }
    if (colorHost) {
        // An arrowless colored goal's host interrupts the column for
        // everyone (suppressed = a 2x gap; present = no/limited
        // outgoing edges), so it must be the column CEILING: every
        // column key inside its requirement, and no top portal above
        // it to climb to.
        const topColored = [...pickups, ...(arrowFree ? [arrowFree] : [])]
            .find((g) => g.hostColor && !hasArrow(g.req));
        if (topColored) {
            if (topColored !== arrowFree && arrowFree) {
                throw new Error(`generateLevelFromSpecs: colored pickup '${topColored.id}' `
                    + `cannot coexist with the arrowless exit '${arrowFree.id}' — nothing `
                    + 'climbs past a colored host (dj behaviors)');
            }
            for (const key of columnKeys) {
                if (!isSubsetReq(key, topColored.req)) {
                    throw new Error(`generateLevelFromSpecs: colored goal '${topColored.id}' `
                        + `must be the column ceiling — [${key.join(',')}] is not within `
                        + `[${topColored.req.join(',')}] (dj behaviors)`);
                }
            }
        }
    }

    // Greedy attach-key choice per branch exit, smallest requirement
    // first. Preferred: attach at the requirement's own segment
    // (key = R; any drift arrow already in R tops it up to itself).
    // Fallback: drop one arrow from R (key = R \ {d}; the drift
    // supplies it) — this is what lets {left} coexist with {springs}.
    // Every chosen key must keep the column's key set nested, and sit
    // at-or-below the arrowless top exit when one exists.
    const branchExits = exits.filter((e) => e !== arrowFree);
    const chosenKeys = [...columnKeys];
    for (const e of [...branchExits].sort((a, b) => a.req.length - b.req.length)) {
        const drifts = ARROW_ABILITIES.filter((a) => e.req.includes(a));
        // colorHost: brown rides the tip's host platform, not the
        // column — strip it from attach-key candidates (blue stays:
        // it's a column stepping stone in both profiles)
        const baseReq = colorHost ? e.req.filter((a) => a !== 'brown') : e.req;
        const options = [
            ...drifts.map((d) => ({ d, key: baseReq })),
            ...drifts.map((d) => ({ d, key: baseReq.filter((a) => a !== d) })),
        ];
        let chosen = null;
        for (const opt of options) {
            if (arrowFree && !isSubsetReq(opt.key, arrowFree.req)) continue;
            if (nests([...chosenKeys, opt.key])) continue;
            chosen = opt;
            break;
        }
        if (!chosen) {
            throw new Error(`generateLevelFromSpecs: exit '${e.id}' [${e.req.join(',')}] has no `
                + 'drift arrow whose attach key fits the column chain'
                + (arrowFree ? ` below the arrowless exit [${arrowFree.req.join(',')}]` : ''));
        }
        e.attachKey = chosen.key;
        e.drift = chosen.d;
        chosenKeys.push(chosen.key);
    }

    const ceiling = chosenKeys.sort((a, b) => a.length - b.length).pop() ?? [];
    return { exits, pickups, arrowFree, ceiling };
}

/** One multi-target proposal. Throws on placement dead-ends (retryable). */
function proposeLevelFromSpecs({
    id, exits, pickups, arrowFree, ceiling, rng, stepsBetween, jitter, C, G, colorHost,
}) {
    const PLAIN_DY = G.PLAIN_DY;
    const branchExits = exits.filter((e) => e !== arrowFree);

    // Segment chain: every key the column must realise, smallest first.
    // Branch exits' attach keys (and drift arrows) were fixed during
    // spec normalization.
    const keyMap = new Map();
    for (const req of [
        ...pickups.map((p) => p.req),
        ...branchExits.map((e) => e.attachKey),
        ceiling,
    ]) keyMap.set(reqKey(req), req);
    const segments = [...keyMap.values()].sort((a, b) => a.length - b.length);

    // Build the column as annotated steps. Each step's `key` is the
    // cumulative gate set once the rung it realises has been reached.
    const steps = [];
    let current = [];
    const plains = (extra = 0) => {
        const n = 1 + Math.floor(rng.next() * stepsBetween) + extra;
        for (let i = 0; i < n; i++) steps.push({ dy: PLAIN_DY, jitter: true, key: current });
    };
    for (const segment of segments) {
        // colorHost: brown never becomes a gate segment — it rides the
        // goal's own host platform (the brown pickup/top-exit below).
        // Blue remains a stepping-stone gate segment in both profiles.
        const newGates = rng.shuffle(segment.filter((a) => !current.includes(a)
            && !(colorHost && a === 'brown')));
        for (const ability of newGates) {
            plains();
            const parts = gateSteps(ability, rng, G);
            current = [...current, ability].sort();
            // The rung above a gate has the gate passed; blue/brown's
            // trailing plain shares the completed key.
            for (const part of parts) steps.push({ ...part, key: current });
        }
        // Rungs for this segment: one per attaching branch exit (the
        // drift arrow is fixed, so same-key same-drift exits need
        // distinct rungs) + pickups + at least one plain.
        const demand = branchExits.filter(
            (e) => reqKey(e.attachKey) === reqKey(segment)).length;
        plains(demand);
        for (const pk of pickups) {
            if (reqKey(pk.req) !== reqKey(segment)) continue;
            steps.push({ dy: PLAIN_DY, pickup: pk.id, key: current, hostType: pk.hostColor });
        }
    }
    if (arrowFree) {
        plains();
        steps.push({ dy: PLAIN_DY, exitTop: arrowFree, key: current, hostType: arrowFree.hostColor });
    }

    // Realise the column in relative coords (entrance at 0,0; y up is
    // negative). Normalised to level space after branches attach.
    const platforms = [];
    const springs = [];
    const jetpacks = [];
    const pickupEntities = [];
    const portals = [];
    const rungs = [];
    let n = 0;
    // Blue hosts under moving behaviors get FULL-WIDTH sweeps — the
    // bounds are assigned after width normalization (the sweep is in
    // level coords); until then the bare 'blue' type marks them.
    const place = (px, py, type = 'green') => {
        const platform = { id: `p${n++}`, x: px, y: py, type };
        platforms.push(platform);
        return platform;
    };
    let x = 0;
    let y = 0;
    let prev = place(x, y);
    rungs.push({ x, y, platform: prev, key: reqKey([]), isPortalHost: false });
    for (const s of steps) {
        if (s.spring) springs.push({ id: `s${n}`, x: prev.x, y: prev.y - 5, on: prev.id });
        if (s.jetpack) jetpacks.push({ id: `j${n}`, x: prev.x, y: prev.y - 5, on: prev.id });
        x += s.dx ?? 0;
        y -= s.dy;
        const dx = (s.jitter && jitter > 0) ? (rng.next() - 0.5) * 2 * jitter : 0;
        prev = place(x + dx, y, s.hostType ?? s.type ?? 'green');
        const rung = {
            x: prev.x, y: prev.y, platform: prev, key: reqKey(s.key),
            isPortalHost: false,
            // nothing launches off a colored host (dj behaviors) —
            // branch tips must not attach here
            isColoredHost: !!s.hostType,
        };
        rungs.push(rung);
        if (s.pickup) {
            pickupEntities.push({ id: s.pickup, x: prev.x, y: prev.y - 20, on: prev.id });
        }
        if (s.exitTop) {
            rung.isPortalHost = true;
            portals.push({
                id: s.exitTop.id, x: prev.x, y: prev.y - 20, on: prev.id,
                target_region: null, direction: s.exitTop.direction ?? 'up',
            });
        }
    }

    // Attach branch tips. Slot bookkeeping prevents two branches from
    // sharing a (rung, side); the proximity check keeps tips clear of
    // every other platform (interception territory).
    const usedSlots = new Set();
    // Interception clearance around a prospective branch tip: one
    // platform width + the catch half-span horizontally (classic 102),
    // half a plain step vertically (classic 60).
    const clearX = C.PLATFORM_WIDTH + C.PLATFORM_WIDTH / 2 + C.PLAYER_HALF_WIDTH;
    const clearY = PLAIN_DY / 2;
    // A moving blue sweeps the FULL width: nothing may share its
    // height band (vertical-only check); statics use the x clearance.
    const movingBlue = (p) => p.type === 'blue' && C.PLATFORM_BEHAVIORS?.blue === 'moving';
    const spotClear = (sx, sy) => !platforms.some((p) => {
        if (Math.abs(p.y - sy) >= clearY) return false;
        return movingBlue(p) || Math.abs(p.x - sx) < clearX;
    });
    for (const exit of branchExits) {
        const key = reqKey(exit.attachKey);
        const d = exit.drift;
        const dir = d === 'right' ? +1 : -1;
        const candidates = rng.shuffle(rungs.filter(
            (r) => r.key === key && !r.isPortalHost && !r.isColoredHost));
        let placed = false;
        for (const rung of candidates) {
            const slot = `${rung.platform.id}:${d}`;
            if (usedSlots.has(slot)) continue;
            const sx = rung.x + dir * G.BRANCH_DX;
            const sy = rung.y - PLAIN_DY;
            if (!spotClear(sx, sy)) continue;
            usedSlots.add(slot);
            const host = place(sx, sy, exit.hostColor ?? 'green');
            portals.push({
                id: exit.id, x: sx, y: sy - 20, on: host.id,
                target_region: null,
                direction: exit.direction ?? d,
            });
            placed = true;
            break;
        }
        if (!placed) {
            throw new Error(`no branch spot for exit '${exit.id}' (key [${key}])`);
        }
    }

    // Normalise: symmetric width around the spawn column (physics
    // spawns at width/2; x is modular under screen wrap), vertical
    // margins matching the single-target generator's.
    let maxAbsX = 0;
    let minY = 0;
    for (const p of platforms) {
        maxAbsX = Math.max(maxAbsX, Math.abs(p.x));
        minY = Math.min(minY, p.y);
    }
    let halfSpan;
    if (G.WIDTH_MODE === 'fixed') {
        // The level width is a profile CONSTANT — the wrap point and
        // the renderer's zoom never depend on platform placement.
        const fixedWidth = G.FIXED_WIDTH ?? G.WIDTH;
        halfSpan = fixedWidth / 2;
        if (maxAbsX + 70 > halfSpan) {
            throw new Error(`column span ${Math.round(maxAbsX)} does not fit the fixed `
                + `${fixedWidth}px width`);
        }
    } else {
        // Width discipline under screen wrap: single-arrow goals stay
        // single-arrow only when the wrap path is too long for the
        // available arcs. The asymmetry sweep (wrapAsymmetry.test.js)
        // shows ±140 branch tips are wrong-arrow-reachable below
        // ~600px width (spring/jetpack airtime wraps a 420px level),
        // so levels with any arrow-gated goal get a width floor
        // (G.ARROW_HALF_WIDTH_FLOOR). The verify loop remains the
        // gatekeeper either way.
        const anyArrowGoal = [...exits, ...pickups]
            .some((g) => g.req.some((a) => ARROW_ABILITIES.includes(a)));
        halfSpan = Math.max(maxAbsX + 70, anyArrowGoal ? G.ARROW_HALF_WIDTH_FLOOR : 0);
    }
    const shiftX = halfSpan;
    const shiftY = 60 - minY;
    const shift = (e) => { e.x += shiftX; e.y += shiftY; };
    platforms.forEach(shift);
    springs.forEach(shift);
    jetpacks.forEach(shift);
    pickupEntities.forEach(shift);
    portals.forEach(shift);

    // Full-width sweeps for moving blues (level coords, so assigned
    // after the shift): centers run MARGIN .. WIDTH-MARGIN, like DJ's
    // 15..195 on the 240 stage. Deterministic phase 0 (state tick 0 =
    // the sweep's left bound, moving right).
    if (C.PLATFORM_BEHAVIORS?.blue === 'moving') {
        for (const p of platforms) {
            if (p.type !== 'blue') continue;
            p.sweep = {
                min: BLUE_SWEEP_EDGE_MARGIN,
                max: 2 * halfSpan - BLUE_SWEEP_EDGE_MARGIN,
            };
        }
    }

    return {
        id,
        size: { width: 2 * halfSpan, height: shiftY + 100 },
        platforms, springs, jetpacks,
        pickups: pickupEntities,
        portals,
    };
}

// ── 2-wide braid generator (Regime 1: arrows free) ───────────────────
//
// An alternative to the fixed-column proposer for top-down regions where
// the player holds both arrows for free. There is no no-arrows spine to
// anchor and no single-arrow gate soundness to protect, so the geometry
// only has to be TRAVERSABLE: every goal reachable with {left,right}. That
// frees the level from the column's symmetric width-fit wall — the braid
// lives directly on the [0,width) wrap ring, so it fits narrow widths
// (≥ ~2·catchSpan) that the column model can't.
//
// Structure: a vertical state machine over 1–2 active lanes. A 1-lane row
// either continues (meander) or forks into two distinct branches (pitch
// ≥ catchSpan, both within one hop of the parent). A 2-lane row either
// continues (rigid shift, preserving the pitch) or merges back to one. At
// most two lanes are ever active (the width budget; see the packing math).
// Portals ride fork branches or the single-lane capstone; pickups go
// anywhere. (Colored-platform rules, for when this grows past green:
// blue only on 1-lane rows — it sweeps the full width; brown only on
// 2-lane rows about to merge or the top row — it breaks on landing.)

// Cached one-hop horizontal reach: max px a held arrow drifts the player
// while ascending one PLAIN_DY level (landing is descent-only, so this is
// the travel at the descent-crossing of the level above). Measured with
// the real step(), like launchRise.
const _braidReachCache = new Map();
function oneHopReach(C, PLAIN_DY) {
    const byDy = _braidReachCache.get(C) ?? {};
    if (byDy[PLAIN_DY] !== undefined) return byDy[PLAIN_DY];
    const W = 1e9, Y0 = 1e6;
    const level = {
        id: '_reach', size: { width: W, height: Y0 + 1e6 },
        platforms: [{ id: 'p', x: W / 2, y: Y0, type: 'green' }],
        springs: [], jetpacks: [], pickups: [], portals: [],
    };
    const ab = { left: true, right: true };
    let s = {
        x: W / 2, y: Y0 - 2, vx: 0, vy: 1, fallen: false,
        landedOn: null, launch: null, t: 0, broken: [], latched: null, jetpackTicks: 0,
    };
    let launchX = null, launchY = null, launched = false, roseAbove = false;
    let reach = PLAIN_DY;
    for (let i = 0; i < 5000; i++) {
        s = step(s, { right: true }, level, ab, C);
        if (!launched && s.landedOn === 'p') { launched = true; launchX = s.x; launchY = s.y; continue; }
        if (launched) {
            if (s.y < launchY - PLAIN_DY) roseAbove = true;
            if (roseAbove && s.vy > 0 && s.y >= launchY - PLAIN_DY) { reach = Math.abs(s.x - launchX); break; }
        }
    }
    byDy[PLAIN_DY] = reach;
    _braidReachCache.set(C, byDy);
    return reach;
}

// Short-arc midpoint of two x positions on a width-W wrap ring — within
// reach of both when they're ≤ 2·reach apart on the short arc.
function wrapMid(a, b, W) {
    let d = (((b - a) % W) + W) % W;
    if (d > W - d) d -= W;
    return (((a + d / 2) % W) + W) % W;
}

// Build a 2-wide braid level. Goals are { id, req, direction }. `req` is
// only consulted for the reachability budget (Regime 1 = {left,right});
// placement ignores it. width defaults to the profile's fixed width.
function proposeBraidLevel({ id, exits, pickups, rng, C, G, jitter = 0, width, decorChance = {} }) {
    const PLAIN_DY = G.PLAIN_DY;
    const W = width ?? G.FIXED_WIDTH ?? G.WIDTH;
    // Per-eligible-platform chances for each decoration (0 = never).
    const {
        blue: blueChance = 0, brown: brownChance = 0,
        spring: springChance = 0, jetpack: jetpackChance = 0,
    } = decorChance;
    const reach = oneHopReach(C, PLAIN_DY);
    const catchSpan = C.PLATFORM_WIDTH + 2 * C.PLAYER_HALF_WIDTH;
    // Fork branches at parent ± forkHalf: pitch 2·forkHalf must exceed the
    // catch span (distinct branches) and each branch stay within one hop.
    const forkHalf = Math.min(reach * 0.85, catchSpan / 2 + 8);
    if (2 * forkHalf <= catchSpan || forkHalf > reach) {
        throw new Error(`braid: width ${W} cannot host two distinct branches `
            + `(forkHalf ${Math.round(forkHalf)}, catchSpan ${catchSpan}, reach ${Math.round(reach)})`);
    }
    const maxStep = Math.min(jitter || 0, reach * 0.85);
    const wrap = (x) => (((x % W) + W) % W);
    const jit = () => (maxStep ? (rng.next() * 2 - 1) * maxStep : 0);

    let nid = 0;
    const platforms = [], portals = [], pickupEntities = [], springEntities = [], jetpackEntities = [], teleportEntities = [];
    const place = (x, y, type = 'green') => {
        const p = { id: `b${nid++}`, x: wrap(x), y, type };
        platforms.push(p);
        return p;
    };
    // Decoration helpers. Regime 1: all of blue/brown/springs/jetpacks are
    // FREE abilities, so these change FEEL not logic; the verifier confirms the
    // climb survives. Placement rules from the physics:
    //  - BLUE: only 1-lane rows — under dj it sweeps the FULL width, so it
    //    can't share a row with a second lane. Rise clears a plain step.
    //  - BROWN: only terminal — it breaks on landing and its weak bounce can't
    //    clear a plain step, so it goes where you don't climb on from it: one
    //    branch of an about-to-merge pair (the OTHER, green branch reaches the
    //    merge), or the top-row PORTAL branch (terminal — it exits the region).
    //  - SPRING / JETPACK: only 1-lane rows — they launch HIGHER, so the gap
    //    ABOVE them grows to SPRING_GAP / JETPACK_GAP, which a single row can
    //    own only when there's one lane. (A 2-lane row would need both lanes to
    //    share the bigger gap.) Mutually exclusive with blue and each other.
    // Blue (phase enumeration) and brown (broken-state search) each branch the
    // reachability solver, so cost is exponential in their COUNT — cap them.
    // Springs/jetpacks are deterministic launches (no branching) — uncapped.
    let blueCount = 0, brownCount = 0;
    const BLUE_CAP = 2, BROWN_CAP = 4;
    const maybeBlue = (p) => {
        if (blueCount < BLUE_CAP && rng.next() < blueChance) { p.type = 'blue'; blueCount += 1; }
        return p;
    };
    // A brown platform must not share a ROW with ANOTHER platform that hosts a
    // terminal — an exit PORTAL or a return-to-start TELEPORTER. Both are dead
    // ends (a portal exits the region; a teleporter sends you home, and a brown
    // breaks on landing), so a [brown, terminal] row leaves no solid platform to
    // launch from and the climb is stranded. A terminal ON the brown itself is
    // fine (the landing fires before the break) — only the SIBLING is forbidden.
    // Same-row platforms share an exact y (placed off the same `y`), so the scan
    // is exact; terminals are already placed by every maybeBrown call site (fork
    // portals in a prior row, the capstone portal+teleport just above).
    const yOfHost = (hostId) => platforms.find((q) => q.id === hostId)?.y;
    const rowHasOtherTerminal = (p) => [...portals, ...teleportEntities]
        .some((e) => e.on !== p.id && yOfHost(e.on) === p.y);
    const maybeBrown = (p) => {
        if (rowHasOtherTerminal(p)) return;
        if (brownCount < BROWN_CAP && rng.next() < brownChance) { p.type = 'brown'; brownCount += 1; }
    };
    // Decorate a 1-lane platform and return the gap ABOVE it (the next row's
    // climb distance). Jetpack > spring > blue, at most one.
    const decorate1Lane = (p) => {
        if (rng.next() < jetpackChance) {
            jetpackEntities.push({ id: `jet_${p.id}`, x: p.x, y: p.y - 5, on: p.id });
            return G.JETPACK_GAP.min + rng.next() * G.JETPACK_GAP.span;
        }
        if (rng.next() < springChance) {
            springEntities.push({ id: `spr_${p.id}`, x: p.x, y: p.y - 5, on: p.id });
            return G.SPRING_GAP.min + rng.next() * G.SPRING_GAP.span;
        }
        maybeBlue(p);
        return PLAIN_DY;
    };
    const pendingExits = [...exits];
    const pendingPickups = [...pickups];
    const capExit = pendingExits.pop(); // reserved for the single-lane capstone
    const placePickup = (p) => {
        if (!pendingPickups.length) return;
        const pk = pendingPickups.shift();
        pickupEntities.push({ id: pk.id, x: p.x, y: p.y - 20, on: p.id });
    };
    const placeExit = (p, e) => portals.push({
        id: e.id, x: p.x, y: p.y - 20, on: p.id, target_region: null, direction: e.direction ?? 'up',
    });
    // A teleport-to-start host: landing returns the player to the entrance.
    // Used on the top row's portal-free branch (replacing the over-the-top
    // wraparound) — terminal, so it ends a branch without stranding the climber.
    const placeTeleport = (p) => teleportEntities.push({
        id: `tp_${p.id}`, x: p.x, y: p.y - 20, on: p.id,
    });
    // Fork the single lane into two branches at the current y. A portal goes
    // on AT MOST ONE branch (random side); the OTHER branch is always
    // portal-free, so the climb can never be dead-ended by both branches
    // exiting the region — there is always a way to keep going up (and the
    // player can choose NOT to take the portal). The free branch gets a
    // pickup if any remain. A null exit makes a decorative (portal-free) fork.
    const fork = (parent, exit) => {
        const L = place(parent.x - forkHalf, y);
        const R = place(parent.x + forkHalf, y);
        lanes = [L, R];
        if (exit) {
            const [portalSide, freeSide] = rng.next() < 0.5 ? [L, R] : [R, L];
            placeExit(portalSide, exit);
            placePickup(freeSide);
        } else {
            placePickup(L); placePickup(R);
        }
    };

    let y = 0;
    let nextGap = PLAIN_DY; // climb distance to the next row (grows over a spring/jetpack)
    let lanes = [place(W / 2, 0)]; // row 0 = entrance, single lane at spawn x (never decorated)
    let guard = 0;
    while ((pendingExits.length || pendingPickups.length) && guard++ < 300) {
        y -= nextGap;
        nextGap = PLAIN_DY; // default; a 1-lane spring/jetpack below bumps it
        if (lanes.length === 1) {
            // continue-1 vs fork-1→2: ~even, but force a fork while exits await
            // (portals only ride forks, one per fork).
            const doFork = pendingExits.length ? true : rng.next() < 0.5;
            if (doFork) {
                fork(lanes[0], pendingExits.length ? pendingExits.shift() : null);
            } else {
                const np = place(lanes[0].x + jit(), y);
                lanes = [np];
                nextGap = decorate1Lane(np); // 1-lane → blue/spring/jetpack-eligible
                placePickup(np);
            }
        } else {
            // 2-lane: continue (pickups only — NEVER a portal, so neither lane
            // is ever blocked) or merge. Merge while exits await to free up the
            // next 1-lane fork.
            const doMerge = pendingExits.length ? true : rng.next() < 0.5;
            if (doMerge) {
                // One about-to-merge branch may BREAK (brown): the merge is
                // reached from the OTHER (green) branch, so traversal survives.
                maybeBrown(lanes[Math.floor(rng.next() * 2)]);
                const m = place(wrapMid(lanes[0].x, lanes[1].x, W), y);
                lanes = [m];
                nextGap = decorate1Lane(m); // merge is 1-lane → decoratable
                placePickup(m);
            } else {
                const d = jit();
                const L = place(lanes[0].x + d, y); // rigid shift keeps the pair ≥ catchSpan apart
                const R = place(lanes[1].x + d, y);
                lanes = [L, R];
                placePickup(L); placePickup(R);
            }
        }
    }
    if (pendingExits.length || pendingPickups.length) {
        throw new Error(`braid: ${pendingExits.length} exits + ${pendingPickups.length} pickups unplaced`);
    }
    // Top row: a FORK — one branch hosts the reserved portal, the OTHER hosts
    // a teleport-to-start. So even at the top there's always a portal-free
    // branch, and climbing it returns the player to the entrance (the teleport
    // REPLACES the old over-the-top wraparound — one mechanic, not two).
    if (lanes.length === 2) {
        y -= nextGap;
        nextGap = PLAIN_DY;
        maybeBrown(lanes[Math.floor(rng.next() * 2)]);
        const m = place(wrapMid(lanes[0].x, lanes[1].x, W), y);
        lanes = [m];
        nextGap = decorate1Lane(m);
    }
    y -= nextGap;
    {
        const L = place(lanes[0].x - forkHalf, y);
        const R = place(lanes[0].x + forkHalf, y);
        lanes = [L, R];
        const [portalSide, teleSide] = rng.next() < 0.5 ? [L, R] : [R, L];
        placeExit(portalSide, capExit);
        placeTeleport(teleSide);
        // maybeBrown is a no-op here: the portal branch shares this row with the
        // teleport branch, and a brown beside a terminal would strand the climb
        // (rowHasOtherTerminal). Kept for the (rare) future where the capstone is
        // single-lane; today it always declines.
        maybeBrown(portalSide);
    }

    let minY = 0;
    for (const p of platforms) minY = Math.min(minY, p.y);
    const shiftY = 60 - minY; // entrance to the bottom; x already absolute in [0,W)
    for (const arr of [platforms, portals, pickupEntities, springEntities, jetpackEntities, teleportEntities]) {
        for (const e of arr) e.y += shiftY;
    }
    // Moving-blue sweeps run the full level width (dj). In level coords, so
    // assigned after the y-shift; static-blue profiles (classic) leave them be.
    if (C.PLATFORM_BEHAVIORS?.blue === 'moving') {
        for (const p of platforms) {
            if (p.type !== 'blue') continue;
            p.sweep = { min: BLUE_SWEEP_EDGE_MARGIN, max: W - BLUE_SWEEP_EDGE_MARGIN };
        }
    }
    return {
        id, size: { width: W, height: shiftY + 100 },
        platforms, springs: springEntities, jetpacks: jetpackEntities,
        pickups: pickupEntities, portals, teleports: teleportEntities,
    };
}

// ── Regime 2: gated single-platform braid (sphere growth) ────────────
//
// When a braid region's goals carry real `requirement`s (sphere growth, where
// abilities are GATED items — not the free starting inventory of Regime 1),
// the geometry must actually gate: each goal's derived minimal sets must equal
// its requirement. The Regime-1 fork braid CAN'T gate by arrow (its two
// branches are ~half a hop apart on the ring, so one arrow reaches the other
// via wrap — they LEAK), so Regime 2 abandons forks for a fork-free
// single-climbable-platform-per-row CHAIN — exactly the geometry the row-aware
// `deriveBraidAccessRules` is verdict-identical to the full solver on.
//
// Gating primitives (verified at dj width 240; see deriveBraidRules tests):
//  - ARROW gate ROW: the single climbable platform is offset ±arrowOffset
//    toward the gating arrow (one hop reach is HALF the ring, so an offset is
//    `left`-only at −, `right`-only at +, free only at 0). A TELEPORT-to-start
//    host sits at ∓arrowOffset — the spot the population MISSING the arrow
//    drifts to (wrong-arrow player lands there → sent home, no soft-lock; the
//    gate platform itself is wrong-arrow-unreachable). At most ONE distinct
//    arrow per region (you never gate left AND right — the player holds an
//    arrow from the start region; a fork can't gate, a chain gates only one).
//  - BLUE gate: a blue stepping stone + a plain landing above it (a no-blue
//    bounce can't use the stone — it's suppressed — so the 2× gap can't be cleared).
//  - SPRING / JETPACK gate: a launchable host + a tall gap above it that a plain
//    bounce can't clear but the booster launch can (the booster is inactive
//    without the item, so the gap gates it). Jetpacks make ~6000px-tall levels.
//  - BROWN gate: brown is suppressed without the item AND terminal with it (it
//    breaks on landing, no climbing past), so it can only host a CEILING goal —
//    the chain's topmost goal rides a brown platform (column `colorHost` rule).
//    At most one brown goal per region, and its requirement must be the ceiling.
//  - Gates compose as a NESTED chain (each goal's requirement a prefix of the
//    cumulative gate set below it). The arrow gate stacks IN the chain (shifting
//    it); blue/spring/jetpack are vertical gates in the chain; brown rides the
//    ceiling goal's host. Anything that can't nest (two arrows, incomparable
//    reqs, a non-ceiling brown) DECLINES → the region falls back to a column.
//
// Jitter is ARROW-DIRECTIONAL: a free rung never jitters (the arrow-free spine
// stays straight at offset 0, so arrow-free goals derive exactly []); once the
// player holds an arrow, rungs above the gate may drift TOWARD it (still
// reachable with that arrow, and the gate below already demands it).

const ARROW_NAMES = ['left', 'right'];
// Physics abilities the gated braid can realise as geometry: all six (arrows as
// gate rows, blue/spring/jetpack as vertical chain gates, brown as a ceiling host).
const BRAID_GATE_ABILITIES = new Set(['left', 'right', 'blue', 'springs', 'jetpacks', 'brown']);

// Pixels shaved off a spring/jetpack gate's gap (below the window's upper bound)
// so a launch from the player's arrival state clears it with real headroom
// rather than the ~4px the bare upper bound leaves. The row-aware braid verifier
// rejects reductions ≥32px, so 20 keeps a safe buffer. See realiseBoostGate.
const BOOST_GATE_GAP_MARGIN = 20;

/**
 * Validate + plan a gated braid chain (spec-level checks: non-retryable, so
 * the caller runs this ONCE before the generate-and-test loop and throws
 * immediately — mirrors the column path's normalizeSpecGoals). Returns
 * { goals, sortedReqs, goalsByKey } or throws. `goals` are tagged with
 * kind:'exit'|'pickup'.
 */
function planBraidGatedChain(exits, pickups) {
    const goals = [
        ...exits.map((e) => ({ ...e, kind: 'exit' })),
        ...pickups.map((p) => ({ ...p, kind: 'pickup' })),
    ];
    const usedArrows = new Set();
    for (const g of goals) {
        for (const a of g.req) {
            if (!BRAID_GATE_ABILITIES.has(a)) {
                throw new Error(`braid Regime 2: unsupported physics gate '${a}' `
                    + `(goal '${g.id}') — not a known bounce ability`);
            }
            if (ARROW_NAMES.includes(a)) usedArrows.add(a);
        }
    }
    if (usedArrows.size > 1) {
        throw new Error('braid Regime 2: cannot gate both arrows in one region '
            + `(goals require ${[...usedArrows].join(' and ')})`);
    }
    // Brown is TERMINAL (it breaks on landing, nothing climbs past it), so a
    // brown goal can't be a chain SEGMENT — but it CAN ride its own offset TIP
    // beside the green spine (the two-platform rule), gated by suppression (the
    // brown host vanishes without the item). So brown is a per-goal HOST colour,
    // not a rung: the climbable spine keys on each requirement MINUS brown, and
    // those spine levels must form a single nested chain. Any number of brown
    // goals, at any level — each gets a brown tip, the spine stays green.
    const chainKeyOf = (req) => req.filter((a) => a !== 'brown').sort();
    const sortedReqs = [...new Set(goals.map((g) => reqKey(chainKeyOf(g.req))))]
        .map((k) => (k ? k.split('+') : []))
        .sort((a, b) => a.length - b.length);
    for (let i = 1; i < sortedReqs.length; i++) {
        if (!isSubsetReq(sortedReqs[i - 1], sortedReqs[i])) {
            throw new Error('braid Regime 2: spine requirements are not nested '
                + `([${sortedReqs[i - 1].join(',')}] vs [${sortedReqs[i].join(',')}])`);
        }
    }
    // Goals keyed by their requirement (the rung level they attach at).
    const goalsByKey = new Map();
    for (const g of goals) {
        const k = reqKey(g.req);
        if (!goalsByKey.has(k)) goalsByKey.set(k, []);
        goalsByKey.get(k).push(g);
    }
    return { goals, sortedReqs, goalsByKey };
}

/**
 * Can the gated braid realise these specs, or must the region fall back to the
 * column proposer? Returns { ok } or { ok:false, reason }. All-free specs are
 * Regime 1 (always ok); gated specs run the structural plan check (≤1 distinct
 * arrow, spine requirements — req minus brown — nested; brown rides per-goal
 * tips, any number). What still declines: two arrows, mutually-incomparable
 * spine reqs. The grower composes COLUMN-compatible gates (canHostExitGates),
 * so anything the braid can't take is guaranteed buildable as a column — see the
 * fallback in generateLevelFromSpecsGen.
 */
function braidCanRealiseSpecs(exitSpecs, pickupSpecs) {
    try {
        const exits = (exitSpecs ?? []).map((s) => ({
            id: s.id, req: normalizeRequirement(s.requirement, `exit '${s.id}'`),
        }));
        const pickups = (pickupSpecs ?? []).map((s) => ({
            id: s.id, req: normalizeRequirement(s.requirement, `pickup '${s.id}'`),
        }));
        if (![...exits, ...pickups].some((g) => g.req.length > 0)) return { ok: true };
        planBraidGatedChain(exits, pickups); // throws on a braid-incompatible gate set
        return { ok: true };
    } catch (err) {
        return { ok: false, reason: err.message };
    }
}

/**
 * Build a fork-free gated braid chain whose goals each require EXACTLY their
 * spec's ability set. `plan` comes from planBraidGatedChain (validated). Throws
 * only on geometry dead-ends (retryable). Reachable + gated by construction;
 * the caller verifies with deriveBraidAccessRules.
 */
function proposeBraidLevelGated({ id, plan, rng, C, G, jitter = 0, width, freeArrow = 'right', platformRows = 0, decorChance = {} }) {
    const PLAIN_DY = G.PLAIN_DY;
    const W = width ?? G.FIXED_WIDTH ?? G.WIDTH;
    const reach = oneHopReach(C, PLAIN_DY);
    const wrap = (x) => (((x % W) + W) % W);
    // Half the one-hop reach: comfortably inside ONE arrow's reach band and
    // outside the other's (which would have to wrap) and the arrow-free point.
    const arrowOffset = Math.round(reach / 2);
    // A PORTAL tip sits beside the straight bypass on the SAME row, so it must
    // be DISTINCT from it — more than a catch span apart, else the no-input
    // climb could land on the portal instead of the bypass — yet still within
    // ONE arrow's reach (and out of the other's, via wrap). catchSpan + a small
    // margin is the only band that satisfies all three (dj: 110 ∈ [106, 116]).
    const catchSpan = C.PLATFORM_WIDTH + 2 * C.PLAYER_HALF_WIDTH;
    const tipOffset = catchSpan + 4;
    // The SPINE is the straight climbable bypass: it never jitters, so the
    // no-input climb always rides it (a player is never forced onto a portal).
    // PORTALS hang off it on offset TIPS toward the FREE arrow (the held
    // starting arrow), so reaching a portal needs that arrow — which the player
    // always has — while the spine stays portal-free.
    // NOTE: a portal's tip rides exactly tipOffset (catchSpan+4 = 110px on dj)
    // from its bypass vs a single-arrow reach of ~120px — only ~10px of slack —
    // so BIDIRECTIONAL spine wander re-gates a tip (it can wrap a tip's cheaper
    // route onto the opposite arrow; measured: ≳8px re-gates). Hence the legacy
    // bidirectional `maxJit = 0`. The spine DOES wander, by the COHERENT toward-
    // free shift below (`spineJit`), which preserves every relative offset; the
    // wrap-seam caveat (and how portal tips are kept safe under it) is the JITTER
    // note below. What else enriches the spine reuses an ability's own GATING
    // geometry in a block that already holds it (grown gap = spring/jetpack
    // flavor; stepping-stone = blue flavor) — never a retyped plain rung or a
    // mover under a tip.
    const maxJit = 0;
    const freeDir = freeArrow === 'left' ? -1 : 1;
    // Decorative fork companion offset (R1's forkHalf): a DISTINCT catch target
    // (> catchSpan/2, so it never captures the straight no-input spine climb)
    // yet within one free-arrow hop (< reach, so it's a reachable side ledge).
    const forkHalf = Math.min(reach * 0.85, catchSpan / 2 + 8);
    // JITTER (the "Max jitter" setting). The SPINE wanders by a MONOTONIC toward-
    // free shift — COHERENT: each rung builds from the shifted prev, so the whole
    // structure above moves together and every relative offset (gates, tips) is
    // preserved. The free arrow is always held, so a free-ward step is reachable
    // with it → rules-neutral.
    //
    // THE WRAP-SEAM CAVEAT (the real one; the earlier "moving-blue pass-through"
    // story was wrong — see the controlled springs/jetpack test in the plan doc
    // §10). dj carries horizontal velocity, so a SAME-COLUMN (zero-shift) hop
    // within ~30px of the free-ward wrap edge can only be landed by steering
    // INWARD, which needs the GATED arrow. Worse, a PORTAL tip rides tipOffset
    // toward the free edge: once the bypass column drifts past (W − tipOffset),
    // the tip wraps ACROSS the seam and its gate collapses — so a portal bypass
    // is only safe in the TIP WINDOW [the free-near (W − tipOffset) px of the
    // ring]. This hit EVERY non-gated-arrow portal gate identically (blue,
    // springs, jetpacks all 0/N at small jitter, ~full at large — the big steps
    // happened to wrap the spine all the way back into the window); arrow gates
    // were immune only because their high-drift segment HOLDS the gated arrow,
    // making near-seam steering available. Fix: `advanceToTipWindow` walks the
    // coherent drift forward (wrapping the ring) into the tip window before each
    // offset tip, in any block lacking the gated arrow — so the spine wanders at
    // ANY magnitude without re-gating. COMPANIONS jitter regardless (off-spine,
    // host no tip), varying the fork width by ~(reach−forkHalf). Backstop: the
    // per-attempt re-derive.
    const spineJitMax = Math.min(jitter || 0, Math.round(reach * 0.5));
    const spineJit = () => (spineJitMax > 0 ? freeDir * rng.next() * spineJitMax : 0);
    // The arrow a tip would re-gate on if the spine drifts to the free-ward seam
    // (free=right ⇒ the right edge needs left). A block already holding it can
    // steer inward near the seam, so it needs no tip-window correction.
    const gatedArrow = freeArrow === 'left' ? 'right' : 'left';
    // Forward coordinate: distance along the ring in the free direction, so both
    // free arrows share one set of thresholds (forward = toward the free seam).
    const fwd = (x) => (freeDir > 0 ? wrap(x) : wrap(W - x));
    const xOfFwd = (f) => wrap(freeDir > 0 ? f : W - f);
    // Tip window: a portal bypass at forward-coord ≤ TIP_WIN keeps its tip
    // (tipOffset further toward free) clear of the seam (W − tipOffset, minus a
    // 6px margin). A same-column hop also needs the bypass out of the last ~30px
    // before the seam, which TIP_WIN (≈124 ≪ 210) easily satisfies.
    const TIP_WIN = W - tipOffset - 6;
    const FWD_HOP = 80;       // longest reliable forward (toward-free) landing hop
    const SEAM_KEEP = 32;     // keep landings this far short of the free seam
    const compJitMax = Math.min(jitter || 0, Math.max(0, reach - forkHalf - 8));
    const { goals } = plan;
    const isBrown = (g) => g.req.includes('brown');

    // The spine realises every gate EXCEPT brown (brown rides each brown goal's
    // OWN offset tip beside the green spine, gated by suppression — not a chain
    // rung). So the spine order keys on the requirement MINUS brown; brown only
    // colours its goal's tip host.
    const chainKey = (req) => reqKey(req.filter((a) => a !== 'brown'));
    const chainSegs = [...new Set(goals.map((g) => chainKey(g.req)))]
        .map((k) => (k ? k.split('+') : []))
        .sort((a, b) => a.length - b.length);
    const byChain = new Map();
    for (const g of goals) {
        const k = chainKey(g.req);
        if (!byChain.has(k)) byChain.set(k, []);
        byChain.get(k).push(g);
    }

    // ── Realise the chain bottom → top ───────────────────────────────
    let nid = 0;
    const platforms = [];
    const portals = [];
    const pickupEntities = [];
    const teleportEntities = [];
    const springEntities = [];
    const jetpackEntities = [];
    // AUTHORED per-platform requirement: the ability set the BUILDER intends a
    // climber to hold to reach this platform. Recorded separately (never on the
    // platform object — the level model forbids storing rules in geometry), for
    // the report/editor to show beside the VERIFIED derive. `req` defaults to
    // the pre-update `current`; gate realizers pass the post-gate set for the
    // platform their gate actually blocks. Pure intent — the verifier is truth.
    // `authored:false` skips the stamp for DECORATIVE platforms (fork companions)
    // — they carry no gating intent and their verified reachability is whatever
    // the geometry yields (often more than the block's held set), so the
    // authored-vs-verified view only covers the gating skeleton.
    const authoredReqs = {};
    const place = (x, y, type = 'green', req = current, { authored = true } = {}) => {
        const p = { id: `b${nid++}`, x: wrap(x), y, type };
        platforms.push(p);
        if (authored) authoredReqs[p.id] = [...req].sort();
        return p;
    };
    const heldArrow = (current) => current.find((a) => ARROW_NAMES.includes(a)) ?? null;
    const jitterDx = (current) => {
        const a = heldArrow(current);
        if (!a || maxJit <= 0) return 0;
        const m = rng.next() * maxJit; // 0..maxJit toward the held arrow
        return a === 'left' ? -m : m;
    };
    const attach = (g, platform) => {
        if (g.kind === 'exit') {
            portals.push({
                id: g.id, x: platform.x, y: platform.y - 20, on: platform.id,
                target_region: null, direction: g.direction ?? 'up',
            });
        } else {
            pickupEntities.push({ id: g.id, x: platform.x, y: platform.y - 20, on: platform.id });
        }
    };

    let y = 0;
    let current = [];
    let prev = place(W / 2, 0); // row 0 = entrance landing (never gated)

    // Climb a single plain rung, honouring arrow-directional jitter.
    const climbPlain = () => {
        y -= PLAIN_DY;
        prev = place(prev.x + jitterDx(current), y);
        return prev;
    };
    // A padding rung that WANDERS the spine (coherent toward-free shift); see the
    // JITTER note above. Goal/gate rungs use climbPlain (zero shift), so the wander
    // lives entirely here. Columns are SNAPPED TO INTEGER px: a same-column hop has
    // near-zero catch tolerance (dj catch span is non-wrapping — physics §6), so
    // ~17% of arbitrary float columns mis-land a zero-shift hop and re-gate, but
    // integer columns are robust across every row (measured 0/thousands). W/2 and
    // every offset are integers, so rounding the wander keeps the whole structure
    // on the safe grid; jitter=0 is unaffected (no shift to round).
    const climbPad = () => {
        y -= PLAIN_DY;
        prev = place(Math.round(prev.x + spineJit()), y);
        return prev;
    };
    // Walk the coherent drift FORWARD (toward free, wrapping the ring) until the
    // spine column sits inside the tip window, so the next offset tip clears the
    // seam (see the JITTER note). Only meaningful when the spine actually wanders
    // (spineJitMax > 0) and the block can't steer inward at the seam (gated arrow
    // absent) — otherwise a no-op, keeping jitter=0 byte-identical and leaving
    // arrow blocks' free wander untouched. Each step is a plain extra rung whose
    // forward hop stays a reachable free-arrow landing (≤ FWD_HOP) and never lands
    // in the last SEAM_KEEP px before the seam (where it would strand). Bounded by
    // a guard (one ring's worth); a stubborn case just fails the re-derive → retry.
    const advanceToTipWindow = () => {
        if (spineJitMax <= 0 || current.includes(gatedArrow)) return;
        let guard = 0;
        while (fwd(prev.x) > TIP_WIN && guard++ < 16) {
            const fp = fwd(prev.x);
            // Close enough to wrap straight into the window in one hop? Land just
            // inside it (forward-coord 6). Else step forward, short of the seam.
            const target = (W + 6 - fp) <= FWD_HOP ? (W + 6) : Math.min(fp + FWD_HOP, W - SEAM_KEEP);
            y -= PLAIN_DY;
            prev = place(Math.round(xOfFwd(target)), y); // integer grid (see climbPad)
        }
    };
    // Gate row for the one arrow: gate platform toward the arrow, teleport host
    // at the mirror offset (the wrong-arrow player drifts there → home).
    const realiseArrowGate = (arrow) => {
        y -= PLAIN_DY;
        const dir = arrow === 'left' ? -1 : 1;
        const gateReq = [...current, arrow]; // the gate is reachable ONLY with the new arrow
        const gate = place(prev.x + dir * arrowOffset, y, 'green', gateReq);
        const teleHost = place(prev.x - dir * arrowOffset, y); // reachable WITHOUT it (drift → home)
        teleportEntities.push({
            id: `tp_${teleHost.id}`, x: teleHost.x, y: teleHost.y - 20, on: teleHost.id,
        });
        prev = gate;
        current = gateReq.slice().sort();
    };
    // Softlock escape for a VERTICAL gate (blue / spring / jetpack): a terminal
    // teleport ledge beside the gate, reached with the always-held free arrow
    // from the gate's last no-item-reachable platform. A player who climbs the
    // spine to such a gate WITHOUT the gating item lands under an unbridgeable
    // gap (the top teleport sits ABOVE the gate, no help) — this ledge sends
    // them home instead of stalling, the vertical-gate analogue of the arrow
    // gate's mirror teleHost. Placed in an EXISTING row (`rowY`, beside column
    // `fromX`): a FRESH opaque row between a boost host and its far landing would
    // sever the row-adjacency the launch relies on (the sweep's launcher walk
    // stops at the first opaque row). Terminal (teleport) ⇒ no climb edge, so it
    // can sit inside the gap without leaking a bypass (canJump / the braid sweep
    // skip teleport hosts as launchers) and never shifts a goal's derived
    // requirement. Offset forkHalf toward the free arrow — a distinct catch
    // target that never captures the straight no-input spine climb. authored:false
    // (decorative, like the fork companions; carries no gating intent).
    const addGateEscape = (fromX, rowY) => {
        const ledge = place(fromX + freeDir * forkHalf, rowY, 'green', current, { authored: false });
        teleportEntities.push({ id: `tp_${ledge.id}`, x: ledge.x, y: ledge.y - 20, on: ledge.id });
    };
    // Blue stepping stone + a plain landing above. `gate=true` GATES on blue
    // vertically (the 2·PLAIN_DY gap is unbridgeable without the suppressed
    // stone; adds blue to `current`). `gate=false` is FLAVOR — same geometry in
    // a block that ALREADY holds blue, so it's neutral (`current` untouched):
    // without blue the player can't be in this block anyway. Identical to the
    // spring/jetpack flavor pattern; the moving stone rides the straight spine
    // (NOT under an offset tip), so it never perturbs a portal hop.
    const emitBlue = (gate) => {
        const req = gate ? [...current, 'blue'] : [...current]; // stone + landing
        // Escape on the rung BELOW the stone (a plain, non-moving row), NOT the
        // moving stone's own row: a fork sharing the mover's row perturbs the
        // ferry-aware phase analysis (the exhaustive derive then reads the whole
        // spine above as also gated on the arrow, diverging from the suppressing
        // path). The rung below is where a blue-less climber gets stuck anyway,
        // so the escape belongs there.
        if (gate) addGateEscape(prev.x, prev.y);
        y -= PLAIN_DY;
        place(prev.x, y, 'blue', req); // the stone (its x rides the column; sweep added post-shift)
        y -= PLAIN_DY;
        prev = place(prev.x, y, 'green', req);
        if (gate) current = [...current, 'blue'].sort();
    };
    const realiseBlueGate = () => emitBlue(true);
    // Spring / jetpack gate: a launchable host + a tall gap above it. The
    // booster is inactive without the item, so a plain bounce can't clear the
    // gap (gated); with the item the launch clears it. The gap is the upper
    // bound of the profile window (largest clearable gap) MINUS a small safety
    // margin. The bare upper bound sits ~4px under the booster's max rise, so a
    // launch from the player's ARRIVAL state (bot or human) — which rises a hair
    // less than the theoretical max — only "barely lands" and a marginal arrival
    // misses. Shaving BOOST_GATE_GAP_MARGIN px lifts that clearance to ~24px so
    // ordinary arrivals clear comfortably. The gated braid's row-aware verifier
    // rejects reductions ≥32px (the overshoot perturbs the layered flood), so 20
    // keeps a safe buffer; the gate still holds (the gap stays far above a plain
    // bounce's reach) and validateGeometry's overshoot < PLAIN_DY invariant is
    // preserved. Booster launches straight up → landing directly above the host.
    // Shared boost geometry: a green launch host + a tall (item-clearable) gap +
    // a landing. `gate=true` GATES the climb on the ability (adds it to `current`,
    // the landing's authored req gains it). `gate=false` is FLAVOR — only valid
    // in a block that ALREADY holds the ability (caller enforces), so it adds a
    // bouncy spring/jetpack without changing any requirement (`current` is left
    // untouched; without the item the player can't be in this block anyway, so
    // the unclearable gap re-gates nothing the block didn't already require).
    const emitBoost = (ability, entities, prefix, window, gate) => {
        y -= PLAIN_DY;
        const host = place(prev.x + jitterDx(current), y); // green host: reachable WITHOUT the booster
        entities.push({ id: `${prefix}_${host.id}`, x: host.x, y: host.y - 5, on: host.id });
        if (gate) addGateEscape(host.x, host.y); // escape on the host's row, beside the (reachable) host
        y -= window.min + window.span - BOOST_GATE_GAP_MARGIN;
        const req = gate ? [...current, ability] : [...current]; // landing needs the booster
        prev = place(host.x, y, 'green', req);
        if (gate) current = req.slice().sort();
    };
    const realiseBoostGate = (ability, entities, prefix, window) =>
        emitBoost(ability, entities, prefix, window, true);
    // A portal rides an OFFSET TIP toward the free arrow — NOT the spine. The
    // spine rung (`prev`) stays portal-free, so the no-input climb is never
    // forced onto a portal (the "portals only on two-platform rows" rule: the
    // row holds the spine bypass AND the tip). Reaching the tip needs the free
    // arrow, which the player always holds. (The locked-tip escape — a return
    // home for a player who lands on a LOCKED tip and can't drift back — is a
    // follow-up; the spine + top teleport already give a home route from the spine.)
    // An offset tip beside the spine. A BROWN tip is suppressed without the
    // brown item (so its goal is gated on brown), GREEN otherwise; either way
    // the green spine rung carries the no-input climb past it (two-platform rule).
    const placeOffsetTip = (g, type = 'green') => {
        // A brown tip is suppressed without brown → its authored req adds brown;
        // a green tip is reached with the (always-held) free arrow → just current.
        const req = type === 'brown' ? [...current, 'brown'] : current;
        const tip = place(prev.x + freeDir * tipOffset, prev.y, type, req);
        attach(g, tip);
    };

    // Extra PLAIN climb rungs (the "Platform rows" setting) distributed across
    // the chain's segments. The held set is CONSTANT within a segment, so these
    // never change a goal's derived requirement (the verifier confirms each
    // attempt). LOWER segments take their share ABOVE the goals — spacing each
    // gate from the next; the TOP segment takes its share BELOW the goals, which
    // lifts the highest-requirement exit to the summit ("relocate top exit up").
    // 0 ⇒ identical to the minimal gated chain.
    const nSeg = chainSegs.length;
    const extraBySeg = chainSegs.map((_, i) =>
        Math.floor(platformRows / nSeg) + (i < (platformRows % nSeg) ? 1 : 0));
    // An extra row is normally a plain rung, but in a block that ALREADY holds
    // springs/jetpacks/blue it may become a FLAVOR row reusing the matching
    // GATING geometry (grown gap for boosters, stepping-stone+landing for blue)
    // at the panel's existing chances — neutral because the block already
    // requires the ability. Brown is NOT used here (terminal, no climb-onward).
    // Each chance is only rolled when held AND > 0, so platformRows stays
    // byte-identical without decorChance. Blue is CAPPED (its moving sweep makes
    // the verifier enumerate phases — exponential in blue count); boosters are
    // deterministic launches, uncapped. springs > jetpacks (jetpack gaps huge).
    let blueDecor = 0, brownDecor = 0;
    const BLUE_DECOR_CAP = 2, BROWN_DECOR_CAP = 4;
    // A decorative 2-wide stretch: the SPINE stays the guaranteed straight
    // no-input climb; a COMPANION lane bumps out forkHalf toward the free arrow
    // (a reachable side ledge that never captures the no-input climb) for 1-2
    // rows, then MERGES (the spine continues; the companion lane terminates).
    // Companions carry no gating intent (authored:false) and add platforms BEYOND
    // platformRows (forks overshoot the target, by design). The terminal
    // companion may BREAK (brown) in a brown-held block — reached from the spine,
    // so traversal survives (R1's about-to-merge-branch rule). Brown is CAPPED
    // (its broken-state search branches the verifier). The per-attempt re-derive
    // rejects any fork that perturbs a goal.
    // The companion may jitter, but only FURTHER from the spine (toward the free
    // arrow): outward keeps it a distinct catch target (never captures no-input)
    // and within the free-arrow hop (compJitMax bounds forkHalf+jit < reach).
    const emitForkMerge = () => {
        const forkLen = rng.next() < 0.5 ? 1 : 2;
        let companion = null;
        for (let r = 0; r < forkLen; r++) {
            climbPlain(); // spine rung (straight, guaranteed)
            const off = forkHalf + (compJitMax > 0 ? rng.next() * compJitMax : 0);
            companion = place(prev.x + freeDir * off, prev.y, 'green', current, { authored: false });
        }
        // The terminal companion may BREAK (brown). Unlike the on-spine boosters,
        // brown needs NO held-block check: it's an OFF-spine terminal ledge, so
        // without brown it's just suppressed (absent) and the spine still climbs;
        // with brown it's a breakable ledge. Neutral either way. (Brown is never
        // in `current` anyway — the chain handles it via per-goal tip suppression.)
        if (companion && brownDecor < BROWN_DECOR_CAP
            && (decorChance.brown ?? 0) > 0 && rng.next() < decorChance.brown) {
            companion.type = 'brown'; brownDecor += 1;
        }
        climbPlain(); // merge: spine continues, companion lane ends
    };
    // An extra row is normally a plain rung, but in a block that ALREADY holds
    // springs/jetpacks/blue it may become a FLAVOR row reusing the matching
    // GATING geometry (grown gap for boosters, stepping-stone+landing for blue)
    // at the panel's existing chances — neutral because the block already
    // requires the ability. It may instead become a decorative FORK/MERGE (any
    // block). Each chance is only rolled when applicable AND > 0, so platformRows
    // stays byte-identical without decorChance. Blue is CAPPED (its moving sweep
    // makes the verifier enumerate phases); boosters are deterministic, uncapped.
    const maybeBoostRow = () => {
        if (current.includes('springs') && (decorChance.spring ?? 0) > 0
            && rng.next() < decorChance.spring) {
            emitBoost('springs', springEntities, 'spr', G.SPRING_GAP, false); return true;
        }
        if (current.includes('jetpacks') && (decorChance.jetpack ?? 0) > 0
            && rng.next() < decorChance.jetpack) {
            emitBoost('jetpacks', jetpackEntities, 'jet', G.JETPACK_GAP, false); return true;
        }
        if (current.includes('blue') && blueDecor < BLUE_DECOR_CAP
            && (decorChance.blue ?? 0) > 0 && rng.next() < decorChance.blue) {
            emitBlue(false); blueDecor += 1; return true;
        }
        if ((decorChance.fork ?? 0) > 0 && rng.next() < decorChance.fork) {
            emitForkMerge(); return true;
        }
        return false;
    };
    const addRows = (n) => { for (let k = 0; k < n; k++) { if (!maybeBoostRow()) climbPad(); } };

    // Chain segments: distinct requirement keys (minus brown) in nested order.
    // Walk them, realising the gates each adds, then attaching that level's
    // goals. brown only colours its goal's own tip host.
    for (let si = 0; si < nSeg; si++) {
        const segment = chainSegs[si];
        const isTop = si === nSeg - 1;
        const newGates = segment.filter((a) => !current.includes(a));
        // Vertical gates first (blue / spring / jetpack), then the arrow gate
        // row — order is free between them (no goal sits in between).
        for (const a of newGates.filter((g) => !ARROW_NAMES.includes(g))) {
            if (a === 'blue') realiseBlueGate();
            else if (a === 'springs') realiseBoostGate('springs', springEntities, 'spr', G.SPRING_GAP);
            else if (a === 'jetpacks') realiseBoostGate('jetpacks', jetpackEntities, 'jet', G.JETPACK_GAP);
        }
        for (const a of newGates.filter((g) => ARROW_NAMES.includes(g))) {
            realiseArrowGate(a);
        }
        // TOP segment: extra rows go BELOW the goals so the highest exit ends up
        // at the summit (just under the top teleport).
        if (isTop) addRows(extraBySeg[si]);
        const here = byChain.get(reqKey(segment)) ?? [];
        // PICKUPS (non-brown) ride the straight spine (collecting doesn't exit).
        // Place them FIRST, so an in-region item granted here (the start arrow)
        // is collected BELOW the portals that assume the player now holds it. A
        // BROWN pickup can't sit on the spine (terminal → blocks the climb), so
        // it rides a brown tip like a brown exit.
        for (const g of here.filter((gg) => gg.kind === 'pickup')) {
            advanceToTipWindow();
            climbPlain();
            if (isBrown(g)) placeOffsetTip(g, 'brown'); else attach(g, prev);
        }
        // PORTALS ride offset tips above a fresh spine bypass rung — green tips
        // for the spine-gated goals, BROWN tips for brown-gated ones (suppression
        // gates them, the green spine carries the climb past). The bypass is
        // walked into the tip window first so the offset tip clears the wrap seam.
        for (const g of here.filter((gg) => gg.kind === 'exit')) {
            advanceToTipWindow();
            climbPlain();
            placeOffsetTip(g, isBrown(g) ? 'brown' : 'green');
        }
        // LOWER segments: extra rows go ABOVE the goals, climbing toward the
        // next gate (so consecutive gates are spaced out by the padding).
        if (!isTop) addRows(extraBySeg[si]);
    }
    // Top teleport row: a lone teleport-to-start host above the highest goal,
    // so a player who climbs past the top (e.g. a locked top portal) returns
    // home instead of stalling — the chain analogue of the Regime-1 top fork's
    // teleport branch (and the over-the-top retirement). The spine top is always
    // green now (brown only ever rides a tip), so it's always reachable.
    {
        y -= PLAIN_DY;
        const top = place(prev.x + jitterDx(current), y);
        teleportEntities.push({ id: `tp_${top.id}`, x: top.x, y: top.y - 20, on: top.id });
    }

    // Normalise vertically (entrance to the bottom); x is already on [0,W).
    let minY = 0;
    for (const p of platforms) minY = Math.min(minY, p.y);
    const shiftY = 60 - minY;
    for (const arr of [platforms, portals, pickupEntities, teleportEntities,
        springEntities, jetpackEntities]) {
        for (const e of arr) e.y += shiftY;
    }
    // Moving-blue sweeps run the full level width (dj), assigned post-shift.
    if (C.PLATFORM_BEHAVIORS?.blue === 'moving') {
        for (const p of platforms) {
            if (p.type !== 'blue') continue;
            p.sweep = { min: BLUE_SWEEP_EDGE_MARGIN, max: W - BLUE_SWEEP_EDGE_MARGIN };
        }
    }
    const level = {
        id, size: { width: W, height: shiftY + 100 },
        platforms, springs: springEntities, jetpacks: jetpackEntities,
        pickups: pickupEntities, portals, teleports: teleportEntities,
    };
    return { level, authoredReqs };
}

// All bounce abilities, set true — the Regime-1 "free" inventory.
const ALL_FREE_ABILITIES = Object.freeze({
    left: true, right: true, springs: true, jetpacks: true, blue: true, brown: true,
});

// Generate-and-test wrapper for the braid. Light goal normalization (ids +
// ability-validated reqs, none of the column's arrowless/nesting structural
// checks), then verify.
//
// TWO regimes, chosen by whether any goal carries a real requirement:
//
//  - REGIME 1 (every req empty — top-down, arrows free): the only question is
//    "is each goal reachable holding EVERYTHING?" — a SINGLE reachability query,
//    not the full per-subset minimal-set table. That table is ~2^|abilities|
//    more work and EXPLODES with colored platforms; the single query keeps it
//    tractable. Emitted rules are TRIVIAL ([[]] = free): top-down overrides each
//    rule with the SOURCE rule, and authored locks ride gate_rules — so trivial
//    is sound. Uses the fork braid (proposeBraidLevel) with decorations.
//
//  - REGIME 2 (some req non-empty — sphere growth, arrows GATED): the geometry
//    must gate, so build a fork-free gated chain (proposeBraidLevelGated) and
//    verify with the row-aware per-subset table (deriveBraidAccessRules) that
//    every goal's minimal sets EQUAL its requirement — the same matching the
//    column path does with deriveAccessRules. The real derived rides out so the
//    emitter (minimalSetsToRule / emitObstaclePaths) reproduces the gate.
function* generateBraidFromSpecsGen({
    id, exitSpecs, pickupSpecs = [], seed = 1, attempts = 8, jitter = 0, braidWidth, decorChance = {},
    freeArrow = 'right', platformRows = 0, C, G,
}) {
    const seen = new Set();
    const norm = (s, what) => {
        if (!s.id) throw new Error(`braid: ${what} without id`);
        if (seen.has(s.id)) throw new Error(`braid: duplicate goal id '${s.id}'`);
        seen.add(s.id);
        return { id: s.id, req: normalizeRequirement(s.requirement, `${what} '${s.id}'`), direction: s.direction ?? null };
    };
    const exits = exitSpecs.map((s) => norm(s, 'exit'));
    if (!exits.length) throw new Error('braid: at least one exit spec required');
    const pickups = (pickupSpecs ?? []).map((s) => norm(s, 'pickup'));
    const gated = [...exits, ...pickups].some((g) => g.req.length > 0);
    // Regime-2 structural validation runs ONCE (spec-level, non-retryable) so a
    // decline (unsupported gate, both arrows, non-nested) throws immediately.
    const plan = gated ? planBraidGatedChain(exits, pickups) : null;

    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        yield { type: 'attempt', attempt: attempt + 1, attempts };
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        if (gated) {
            // ── Regime 2: gated chain, verify minimal sets == requirement ──
            let level, authoredReqs;
            try { ({ level, authoredReqs } = proposeBraidLevelGated({ id, plan, rng, C, G, jitter, width: braidWidth, freeArrow, platformRows, decorChance })); }
            catch (err) { rejected.push(`attempt ${attempt}: ${err.message}`); continue; }
            const modelErrors = validateLevel(level);
            if (modelErrors.length > 0) { rejected.push(`attempt ${attempt}: ${modelErrors[0]}`); continue; }
            // Hard invariant: every blue must be a green→blue→green stepping
            // stone. The derive verifier suppresses blues everywhere else, which
            // is sound ONLY under this invariant — so a violation is a generator
            // bug that would silently emit an over-permissive rule. Fail loudly.
            const blueErrors = braidBlueInvariantErrors(level);
            if (blueErrors.length > 0) throw new Error(`braid('${id}'): blue-placement invariant violated (suppression unsound): ${blueErrors[0]}`);
            // The free arrow is always-held (treated as free) and portal hosts
            // are terminal — so an offset portal tip derives its gate set, not
            // [freeArrow], and can't leak a skip route past a gate.
            const derived = deriveBraidAccessRules(level,
                { constants: C, freeArrow, terminalPortals: true });
            if (derived.defects.length > 0) { rejected.push(`attempt ${attempt}: ${derived.defects[0]}`); continue; }
            const mismatches = [];
            for (const g of exits) {
                if (!sameSets(derived.exits[g.id].minimalSets, g.req)) {
                    mismatches.push(`exit '${g.id}' derived `
                        + `${JSON.stringify(derived.exits[g.id].minimalSets)} != [${g.req}]`);
                }
            }
            for (const g of pickups) {
                if (!sameSets(derived.pickups[g.id].minimalSets, g.req)) {
                    mismatches.push(`pickup '${g.id}' derived `
                        + `${JSON.stringify(derived.pickups[g.id].minimalSets)} != [${g.req}]`);
                }
            }
            if (mismatches.length === 0) return { level, derived, authoredReqs };
            rejected.push(`attempt ${attempt}: ${mismatches[0]}`);
            continue;
        }
        // ── Regime 1: fork braid, verify pure reachability ──────────────
        let level;
        try { level = proposeBraidLevel({ id, exits, pickups, rng, C, G, jitter, width: braidWidth, decorChance }); }
        catch (err) { rejected.push(`attempt ${attempt}: ${err.message}`); continue; }
        const modelErrors = validateLevel(level);
        if (modelErrors.length > 0) { rejected.push(`attempt ${attempt}: ${modelErrors[0]}`); continue; }
        // NB: no blue-stepping-stone invariant here. Regime 1 (top-down, arrows
        // free) verifies with a single full-ability ferry-AWARE flood (blues NOT
        // suppressed), so its decorative non-stone blues are handled correctly and
        // need not conform. The invariant is required only where the gated derive
        // suppresses blues (Regime 2, below).
        // Single full-ability reachability: every portal/pickup host reachable
        // from the entrance when the player holds all free abilities. The braid
        // is layered by rows with adjacent-row-only edges, so the row-aware
        // flood (early-exiting once every goal host is reached) is verdict-
        // identical to the full N² graph at a fraction of the canJump calls.
        const goalHosts = [
            ...(level.portals ?? []).map((pt) => pt.on),
            ...(level.pickups ?? []).map((pk) => pk.on),
        ];
        const reach = reachableBraidPlatforms(level, ALL_FREE_ABILITIES, { constants: C, goalHosts });
        const bad = [
            ...(level.portals ?? []).filter((pt) => !reach.has(pt.on)).map((pt) => `exit '${pt.id}'`),
            ...(level.pickups ?? []).filter((pk) => !reach.has(pk.on)).map((pk) => `pickup '${pk.id}'`),
        ];
        if (bad.length === 0) {
            const trivial = (gs) => Object.fromEntries(gs.map((g) => [g.id, { minimalSets: [[]] }]));
            // Regime 1 is all-free: authored requirement is [] everywhere, so no
            // authoredReqs map (the report shows verified-only for fork braids).
            return { level, derived: { exits: trivial(exits), pickups: trivial(pickups) }, authoredReqs: null };
        }
        rejected.push(`attempt ${attempt}: ${bad[0]} unreachable`);
    }
    throw new Error(`braid('${id}'): no valid proposal in ${attempts} attempts: ${rejected.join('; ')}`);
}

/**
 * Generate one level whose goals each require EXACTLY their spec's
 * ability set — the multi-target counterpart of generateLevel.
 *
 *   exitSpecs:   [{ id, requirement, direction? }]   (≥1 required)
 *   pickupSpecs: [{ id, requirement }]
 *
 * Spec-level violations (non-nested requirements, more than one
 * arrowless exit, goals above the top portal, unknown abilities)
 * throw immediately; geometry dead-ends retry with a perturbed seed
 * and throw after `attempts`. Verified by deriveAccessRules: every
 * goal's minimal sets must be exactly [its requirement], no defects.
 */
export function generateLevelFromSpecs(opts = {}) {
    const gen = generateLevelFromSpecsGen(opts);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value.level;
}

/**
 * Generator form of generateLevelFromSpecs: yields
 * { type: 'attempt', attempt, attempts } before each generate-and-test
 * attempt (each attempt runs the full verifier — that's where the time
 * goes) and returns { level, derived } — the verified level TOGETHER
 * with the winning attempt's deriveAccessRules result, so callers
 * emitting rules don't re-run the verifier (it's the single most
 * expensive step for dj mover levels). The sync wrapper above drains
 * it with no pauses and returns just the level (stable public shape).
 */
export function* generateLevelFromSpecsGen({
    id,
    exitSpecs,
    pickupSpecs = [],
    stepsBetween = 2,
    seed = 1,
    attempts = 8,
    jitter = 0,
    physics = 'experimental',
    // 'column' (default) = the fixed-column proposer. 'braid' = the 2-wide
    // braid for Regime-1 (free-arrow) top-down regions; braidWidth overrides
    // the level width (defaults to the profile's fixed width). decorChance is
    // { blue, brown, spring, jetpack } per-eligible-platform probabilities.
    mode = 'column',
    braidWidth,
    decorChance = {},
    // The free starting arrow ('left'|'right') — the one the player always
    // holds in a Regime-2 region. Gated-braid portals ride offset tips toward
    // it, and the verifier treats it as free. Default 'right' for tests; the
    // pipeline threads the world's actual pick.
    freeArrow = 'right',
    // Extra PLAIN climb rungs added per region AFTER the gating content
    // (gated braid only) — distributed across the requirement segments to make
    // levels taller and push the hardest exit to the summit. 0 = no change.
    platformRows = 0,
} = {}) {
    const { C, G } = resolveGenPhysics(physics);
    if (mode === 'braid') {
        // The braid honours arrow + blue gates (Regime 2); springs/jetpacks/
        // brown, gating both arrows, or mutually-incomparable requirements are
        // outside its single-chain vocabulary. The grower's veto
        // (canHostExitGates) only guarantees COLUMN-compatibility, so a region
        // it allowed may still be braid-incompatible — fall back to the column
        // proposer for THAT region instead of aborting the whole world (the bot
        // handles both: teleport recovery on braids, descend on columns).
        const can = braidCanRealiseSpecs(exitSpecs, pickupSpecs);
        if (can.ok) {
            return yield* generateBraidFromSpecsGen({
                id, exitSpecs, pickupSpecs, seed, attempts, jitter, braidWidth, decorChance, freeArrow, platformRows, C, G,
            });
        }
        console.warn(`bounce: region '${id}' has gates outside the braid vocabulary `
            + `(${can.reason}) — generating it as a column instead`);
        // The braid's jitter is ARROW-DIRECTIONAL (only shifts toward a held
        // arrow); the column's is not — its plain steps jitter both ways, which
        // only verifies when a goal needs BOTH arrows (a free/single-arrow goal
        // jittered off-column derives the wrong rule). So the column fallback
        // runs with NO jitter, matching plain column sphere growth.
        jitter = 0;
    }
    const colorHost = colorHostMode(C);
    const { exits, pickups, arrowFree, ceiling } = normalizeSpecGoals(
        exitSpecs, pickupSpecs, colorHost);
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        yield { type: 'attempt', attempt: attempt + 1, attempts };
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        let level;
        try {
            level = proposeLevelFromSpecs({
                id, exits, pickups, arrowFree, ceiling, rng, stepsBetween, jitter, C, G, colorHost,
            });
        } catch (err) {
            rejected.push(`attempt ${attempt}: ${err.message}`);
            continue;
        }
        const modelErrors = validateLevel(level);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveAccessRules(level, { constants: C });
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const mismatches = [];
        for (const pk of pickups) {
            if (!sameSets(derived.pickups[pk.id].minimalSets, pk.req)) {
                mismatches.push(`pickup '${pk.id}' derived `
                    + `${JSON.stringify(derived.pickups[pk.id].minimalSets)} != [${pk.req}]`);
            }
        }
        for (const e of exits) {
            if (!sameSets(derived.exits[e.id].minimalSets, e.req)) {
                mismatches.push(`exit '${e.id}' derived `
                    + `${JSON.stringify(derived.exits[e.id].minimalSets)} != [${e.req}]`);
            }
        }
        if (mismatches.length === 0) return { level, derived, authoredReqs: null };
        rejected.push(`attempt ${attempt}: ${mismatches[0]}`);
    }
    throw new Error(`generateLevelFromSpecs('${id}'): no valid proposal in ${attempts} `
        + `attempts: ${rejected.join('; ')}`);
}
