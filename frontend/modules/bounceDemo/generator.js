/**
 * Bounce Demo level generator — build-order step 7, the first shipped
 * milestone (NewDocs/plans/procedural-generation/dj-metroidvania-v2.md).
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
import { DEFAULTS, PROFILES, launchRise } from './physics.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './apRules.js';

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
// CLASSIC_GEOMETRY is PINNED to the legacy literals (not derived) so
// committed presets reproduce byte-identically; validateGeometry
// asserts the structural constraints both pinned and derived values
// must satisfy, and the generate-verify loop remains the gatekeeper
// either way.

export const CLASSIC_GEOMETRY = Object.freeze({
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
export function deriveGeometry(C, base = CLASSIC_GEOMETRY) {
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

// Per-profile pinned geometry; profiles absent here derive from their
// constants.
const GEOMETRIES = Object.freeze({ classic: CLASSIC_GEOMETRY, dj: DJ_GEOMETRY });

/**
 * Resolve a generator `physics` option to { profileId, C, G }.
 * Accepts a profile id (default 'classic') or an explicit
 * { constants, geometry } object (tests, future custom profiles).
 */
export function resolveGenPhysics(physics) {
    if (!physics || physics === 'classic') {
        return { profileId: 'classic', C: DEFAULTS, G: CLASSIC_GEOMETRY };
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

/** Gate-segment steps for one ability (shared by both proposal paths). */
function gateSteps(ability, rng, G) {
    switch (ability) {
        case 'springs':
            return [{ dy: G.SPRING_GAP.min + rng.next() * G.SPRING_GAP.span, spring: true }];
        case 'jetpacks':
            return [{ dy: G.JETPACK_GAP.min + rng.next() * G.JETPACK_GAP.span, jetpack: true }];
        case 'blue':
        case 'brown':
            return [{ dy: G.PLAIN_DY, type: ability }, { dy: G.PLAIN_DY }];
        case 'left':
            return [{ dy: G.PLAIN_DY, dx: -G.BRANCH_DX }];
        case 'right':
            return [{ dy: G.PLAIN_DY, dx: +G.BRANCH_DX }];
        default:
            throw new Error(`generateLevel: no gate builder for '${ability}'`);
    }
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
    physics = 'classic',
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
// requirements in one level — the prefix-graded chain from
// NewDocs/plans/procedural-generation/sphere-driven-growth.md: the
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
const COLOR_ABILITIES = ['blue', 'brown'];
const KNOWN_ABILITIES = new Set(['springs', 'jetpacks', 'blue', 'brown', 'left', 'right']);

const reqKey = (req) => req.join('+');
const hasArrow = (req) => req.some((a) => ARROW_ABILITIES.includes(a));
const isSubsetReq = (a, b) => a.every((x) => b.includes(x));

// ── Color-as-host mode (dj platform behaviors) ──────────────────────
//
// Under dj behaviors blue/brown CANNOT be column-core stepping stones:
// a breaking brown has no outgoing edges (the weak bounce depends on
// arrival speed), and an arrowless jump FROM a moving blue fails the
// ∀-arrival-phase check (the sweep+offset envelope misses the target).
// So a color in a goal's requirement is realized on the GOAL'S OWN
// HOST platform instead of as a gate segment below it:
//
//  - arrow + color exit  → branch tip whose host platform is colored
//    (the drift supplies steering; a blue host gets a ±BLUE_SWEEP_AMP
//    sweep, reached ∃-phase — its rung below is always a static green,
//    the blue-after-green rule by construction).
//  - arrowless colored goal → the unique column-TOP slot (climbing
//    past a colored host is impossible: suppressed = a 2x gap, present
//    = no/limited outgoing edges). At most ONE per level, its
//    requirement must be the column ceiling, and it cannot coexist
//    with an (uncolored) arrowless top exit. Colored pickups with
//    arrows are declined in v1 (pickups have no tip machinery).
//
// Classic behaviors keep the colored stepping-stone gates unchanged.
const colorHostMode = (C) => C.PLATFORM_BEHAVIORS?.blue === 'moving'
    || C.PLATFORM_BEHAVIORS?.brown === 'breaking';
// Moving blues sweep the FULL level width (like DJ: centers 15..195
// of the 240 stage) — the sweep bounds are level data assigned after
// width normalization, with this center-margin at each edge.
const BLUE_SWEEP_EDGE_MARGIN = 15;
const colorsOf = (req) => req.filter((a) => COLOR_ABILITIES.includes(a));

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
        // dj behaviors: colors ride the goal's host platform (see the
        // color-as-host header). Validate and tag.
        for (const g of [...exits, ...pickups]) {
            const colors = colorsOf(g.req);
            if (colors.length > 1) {
                throw new Error(`generateLevelFromSpecs: goal '${g.id}' requires both blue `
                    + 'and brown — one host platform cannot be two types (dj behaviors)');
            }
            g.hostColor = colors[0] ?? null;
        }
        const coloredArrowless = [...exits, ...pickups]
            .filter((g) => g.hostColor && !hasArrow(g.req));
        if (coloredArrowless.length > 1) {
            throw new Error('generateLevelFromSpecs: at most one arrowless colored goal per '
                + `level under dj behaviors (got ${coloredArrowless.map((g) => `'${g.id}'`).join(', ')})`);
        }
        for (const g of exits) {
            if (g.hostColor === 'blue' && hasArrow(g.req)) {
                throw new Error(`generateLevelFromSpecs: exit '${g.id}' combines blue with an `
                    + 'arrow — a blue host sweeps the full level width, so an arrow cannot '
                    + 'gate it (dj behaviors)');
            }
        }
        for (const pk of pickups) {
            if (pk.hostColor && hasArrow(pk.req)) {
                throw new Error(`generateLevelFromSpecs: pickup '${pk.id}' combines a color `
                    + 'with an arrow — colored tip pickups are not supported (dj behaviors)');
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
        // colorHost: colors ride the tip's host platform, not the
        // column — strip them from attach-key candidates
        const baseReq = colorHost ? e.req.filter((a) => !COLOR_ABILITIES.includes(a)) : e.req;
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
        // colorHost: colors never become gate segments — they ride the
        // goal's own host platform (the colored pickup/top-exit below).
        const newGates = rng.shuffle(segment.filter((a) => !current.includes(a)
            && !(colorHost && COLOR_ABILITIES.includes(a))));
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
export function generateLevelFromSpecs({
    id,
    exitSpecs,
    pickupSpecs = [],
    stepsBetween = 2,
    seed = 1,
    attempts = 8,
    jitter = 0,
    physics = 'classic',
} = {}) {
    const { C, G } = resolveGenPhysics(physics);
    const colorHost = colorHostMode(C);
    const { exits, pickups, arrowFree, ceiling } = normalizeSpecGoals(
        exitSpecs, pickupSpecs, colorHost);
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
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
        if (mismatches.length === 0) return level;
        rejected.push(`attempt ${attempt}: ${mismatches[0]}`);
    }
    throw new Error(`generateLevelFromSpecs('${id}'): no valid proposal in ${attempts} `
        + `attempts: ${rejected.join('; ')}`);
}
