/**
 * Runner level generator (plan §4.5; the shape of
 * bounceDemo/generator.js, horizontal).
 *
 * Generate-and-test (Cloudberry-style): `generateLevel` PROPOSES a
 * left-to-right strip for a target requirement ("this level needs
 * ability set S") and VERIFIES it with the same derive-rules verifier
 * the pipeline uses — every pickup and every exit must derive minimal
 * sets of exactly [S], with no defects. Failed proposals retry with a
 * perturbed seed; geometry is stored explicitly (the
 * no-RNG-determinism principle: the seed only drives generation,
 * nothing at runtime replays it).
 *
 * Construction is a chain of RUN SEGMENTS (flat ground floors at y=0,
 * gaps sized for a plain full-hold running jump) with one GATE SEGMENT
 * per required ability — the horizontal analog of bounce's column gate
 * table:
 *   doubleJump — a gap wider than the max single running jump (solver-
 *                swept, coyote included) but inside double-jump reach
 *   blue (stone types) — a gap wider than even double-jump reach with
 *                a one-way stepping stone of that type mid-gap:
 *                suppressed without the item, the gap is uncrossable
 *   spring     — a dj-proof TOTAL gap with a spring mid-gap: the jump
 *                lands on the spring and the deterministic bounce
 *                carries the far half (sweepSpringTotal calibrates
 *                the crossable total; suppressed without Springs)
 * Pickups land on dedicated segments after all gates; the main exit
 * tops the strip's right end. REWARD SHELVES (plan §8.7 step 2): with
 * probability shelfChance an eligible level hangs ONE always-active
 * one-way shelf in its LAST gate's descent corridor (dj/spring gates
 * only — orderGates elects the gate and realizePlan draws the
 * geometry); the crossing arc lands on it, the wake collects its
 * pickup, and the fall-off drops onto the gate's padded landing
 * floor — so the shelf pickup derives exactly [S] like every trunk
 * goal, and planStripSpecs stays untouched (nested-chain rule §8.2).
 * BRANCHES are elevated tip platforms over
 * widened plain gaps after the gates (surplus-exit hosts, portal in
 * the tip's wake); HAZARDS are spike patches on goal-free corridor
 * floors — and every spiked floor gets a FLUSH PARTNER floor after it
 * (the spikeRun-fixture pattern). The partner is load-bearing, not
 * decor: the solver's policy family is one jump per leg, and a leg
 * only ends when support switches platforms — so a spike hop that
 * lands back on the SAME floor must be able to RUN off it alive
 * (flush crossing), not face a second jump-gap it has no jump left
 * for. Spikes on a floor that ends in a jump gap are unsurvivable by
 * construction and fail the whole proposal. The verify run stays the
 * gatekeeper for hazards and tips alike (anything that breaks the
 * route or the gate fails the proposal, retry).
 *
 * Calibration is DERIVED-THEN-SWEPT (bounce's deriveGeometry /
 * sweep-calibrated split): vertical rises come from `jumpHeight`
 * closed-form; horizontal reach has no clean closed form (variable
 * hold under downwardMovementMultiplier + coyote + the solver's own
 * sampling), so `sweepMaxGap` measures it with the SOLVER ITSELF on a
 * two-platform probe — gate windows calibrated against canRun's own
 * verdict absorb the sampling grid by construction. The default
 * profile's geometry is PINNED (CELESTE_GEOMETRY) so committed worlds
 * reproduce byte-identically; other profiles derive on demand and
 * `validateGeometry` asserts the structural constraints either way.
 *
 * `generateZoneSet` builds a whole winnable zone table for the
 * substrate factory: zone 0 requires nothing and grants the first
 * ability item, each later non-filler zone requires a subset of
 * already-granted abilities and grants the next, fillers grant
 * nothing, and the final zone's pickup is Victory.
 */

import { createRng } from '../shared/rng.js';
import { DEFAULTS, PROFILES, DEFAULT_PROFILE_ID, step as physicsStep } from './physics.js';
import { canRun, reachableRunPlatforms } from './canRun.js';
import { deriveAccessRules } from './deriveRules.js';
import { validateLevel } from './level.js';
import { ABILITY_ITEM_NAMES, VICTORY_ITEM_NAME } from './gameCore.js';

const round2 = (v) => Math.round(v * 100) / 100;
const round1 = (v) => Math.round(v * 10) / 10;

// ── Profile geometry ────────────────────────────────────────────────

/**
 * Max flat gap the SOLVER can cross under `abilities` — binary search
 * over a two-platform probe. The probe parameters are FROZEN (12-unit
 * run-up, 8-unit landing, [0.5, cap] search, 20 halvings) so pinned
 * REACH values reproduce exactly; `cap` only needs raising for very
 * fast profiles (sonic/meatboy saturate 16). `dy` raises the LANDING
 * floor (jitter calibration: an up-crossing loses range — the
 * REACH.singleUp pin is this sweep at dy = JITTER_MAX); dy 0 is the
 * frozen flat probe, values unchanged.
 */
export function sweepMaxGap(C, abilities, { cap = 16, dy = 0 } = {}) {
    const probe = (gap) => ({
        id: 'probe',
        size: { width: 12 + gap + 8, height: 16 },
        platforms: [
            { id: 'a', x: 0, y: 0, w: 12, h: 1, type: 'ground' },
            { id: 'b', x: 12 + gap, y: dy, w: 8, h: 1, type: 'ground' },
        ],
        hazards: [], pickups: [], portals: [], spawn: { x: 1, y: 1 },
    });
    let lo = 0.5;
    let hi = cap;
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (canRun(probe(mid), 'a', 'b', abilities, { constants: C })) lo = mid;
        else hi = mid;
    }
    return round2(lo);
}

/**
 * Max TOTAL spring gap (near + spring width + far) the SOLVER can
 * cross under {spring} — the spring-gate analog of sweepMaxGap. The
 * jump onto the spring caps the landing depth, so the crossable TOTAL
 * is invariant in the near/width split (sweep-verified: identical at
 * near 3.5/3.9/4.2 and W 4/5) — the probe fixes near/W and searches
 * far. Probe parameters FROZEN like sweepMaxGap's.
 */
export function sweepSpringTotal(C, { cap = 20 } = {}) {
    const NEAR = 3.8;
    const W = 4;
    const probe = (far) => ({
        id: 'probe',
        size: { width: 12 + NEAR + W + far + 8, height: 24 },
        platforms: [
            { id: 'a', x: 0, y: 0, w: 12, h: 1, type: 'ground' },
            { id: 'spr', x: 12 + NEAR, y: 0, w: W, h: 0.5, type: 'spring' },
            { id: 'b', x: 12 + NEAR + W + far, y: 0, w: 8, h: 1, type: 'ground' },
        ],
        hazards: [], pickups: [], portals: [], spawn: { x: 1, y: 1 },
    });
    let lo = 0.5;
    let hi = cap;
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (canRun(probe(mid), 'a', 'b', { spring: true }, { constants: C })) lo = mid;
        else hi = mid;
    }
    return round2(NEAR + W + lo);
}

/**
 * Max landable RISE onto an elevated one-way shelf under `abilities`
 * — the vertical analog of sweepMaxGap, and the calibration the
 * reward-shelf windows (plan §8.7 step 2) hang off: a spring shelf
 * must sit ABOVE the dj rise (so Double Jump provably can't reach
 * it), a dj shelf strictly BETWEEN the single and dj rises. Probe
 * parameters FROZEN like sweepMaxGap's (12-unit run-up, 0.5 lead,
 * 8-unit shelf, [0.5, cap] search, 20 halvings). Landable rise is
 * lower than the raw apex: the arc must still clear the shelf's left
 * edge moving forward — which is why this is swept, not closed-form.
 */
export function sweepMaxRise(C, abilities, { cap = 12 } = {}) {
    const probe = (rise) => ({
        id: 'probe',
        size: { width: 12 + 0.5 + 8, height: 24 },
        platforms: [
            { id: 'a', x: 0, y: 0, w: 12, h: 1, type: 'ground' },
            { id: 'b', x: 12.5, y: 0.5 + rise, w: 8, h: 0.5, type: 'oneway' },
        ],
        hazards: [], pickups: [], portals: [], spawn: { x: 1, y: 1 },
    });
    let lo = 0.5;
    let hi = cap;
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (canRun(probe(mid), 'a', 'b', abilities, { constants: C })) lo = mid;
        else hi = mid;
    }
    return round2(lo);
}

/**
 * Min ceiling-slab BOTTOM height (above the floors' top) that keeps a
 * `gapW` run gap crossable under NO abilities — the calibration the
 * ceiling-hazard windows (plan §8.7 step 3) hang off. Unlike the
 * other sweeps this one is ENTRY-INCLUSIVE (the flood from the real
 * spawn, the exact predicate the generator's verify run applies) and
 * takes the max over run-up widths that shake the tick lattice: the
 * surviving arcs are coyote-launched short holds, and a single-lattice
 * sweep can find a tick-critical arc a different approach lattice
 * loses (measured on celeste: gap 3.0 sweeps 1.59 on one lattice but
 * 2.81 robustly — which is why CEIL_GAP ends at 2.8 there).
 */
export function sweepCeilingMin(C, gapW, { cap = 12, over = 1.5, slabH = 4.5 } = {}) {
    const probe = (runUp, h) => ({
        id: 'probe',
        size: { width: runUp + gapW + 10, height: 40 },
        platforms: [
            { id: 'a', x: 0, y: 0, w: runUp, h: 1, type: 'ground' },
            { id: 'b', x: runUp + gapW, y: 0, w: 10, h: 1, type: 'ground' },
        ],
        hazards: [{
            id: 'ceil', type: 'ceiling',
            x: runUp - over, y: 1 + h, w: gapW + 2 * over, h: slabH,
        }],
        pickups: [], portals: [], spawn: { x: 1, y: 1 },
    });
    const runUps = [12, 12.29, 12.57, 12.86, 13.14, 13.43, 13.71, 14];
    const ok = (h) => runUps.every(
        (r) => reachableRunPlatforms(probe(r, h), {}, { constants: C }).has('b'));
    if (!ok(cap)) return null; // gap uncrossable even ceiling-free
    let lo = 0.5;
    let hi = cap;
    for (let i = 0; i < 18; i++) {
        const mid = (lo + hi) / 2;
        if (ok(mid)) hi = mid;
        else lo = mid;
    }
    return round2(hi);
}

/**
 * Max glide-chasm width (§8.7 step 4) — the calibration the GLIDE gate
 * windows hang off. The probe is the gate's own frozen geometry: a
 * 3-floor ramp (each `step` up, the worst case for the no-item bound),
 * a `glider` pad `padRise` above the ramp top, and the chasm from the
 * pad's right edge down to a base-height landing floor. The searched
 * quantity is the drawn chasm width in realizePlan's own coordinate
 * (pad right edge → landing floor), for BOTH sides of the window:
 * with {glide} the crossing is the pad walk-off glide (reach grows
 * with the pad height); with {doubleJump} the pad is suppressed and
 * the best launch is the ramp top — lower and further left, so the
 * same drawn width is a strictly harder jump. ENTRY-INCLUSIVE like
 * sweepCeilingMin (the flood from the real spawn — arrivals onto the
 * pad ride the real ramp hops).
 */
export function sweepGlideChasm(C, abilities, {
    step = 1.5, padRise = 1.2, padGap = 1.6, padW = 5.5, cap = 30,
} = {}) {
    const RAMP_GAP = 2.5;
    const RAMP_W = 4;
    const PAD_GAP = padGap;
    const PAD_W = padW;
    const probe = (gap) => {
        const platforms = [{ id: 'a', x: 0, y: 0, w: 12, h: 1, type: 'ground' }];
        let x = 12;
        let rise = 0;
        for (let r = 0; r < 3; r++) {
            rise = round2(rise + step);
            platforms.push({
                id: `r${r}`, x: round2(x + RAMP_GAP), y: rise, w: RAMP_W, h: 1, type: 'ground',
            });
            x = round2(x + RAMP_GAP + RAMP_W);
        }
        platforms.push({
            id: 'pad', x: round2(x + PAD_GAP),
            y: round2(rise + 1 + padRise - 0.5), w: PAD_W, h: 0.5, type: 'glider',
        });
        x = round2(x + PAD_GAP + PAD_W);
        platforms.push({
            id: 'b', x: round2(x + gap), y: 0, w: 40, h: 1, type: 'ground',
        });
        return {
            id: 'probe', size: { width: round2(x + gap + 40), height: 30 },
            platforms, hazards: [], pickups: [], portals: [], spawn: { x: 1, y: 1 },
        };
    };
    const ok = (gap) => reachableRunPlatforms(probe(gap), abilities, { constants: C }).has('b');
    if (!ok(0.5)) return null; // the approach itself fails (no window)
    let lo = 0.5;
    let hi = cap;
    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        if (ok(mid)) lo = mid;
        else hi = mid;
    }
    return round2(lo);
}

/**
 * The grounded-tap arc under `C` — apex player-TOP height above the
 * floor top, and horizontal range back to the same height — measured
 * by running the real engine once (a 1-tick hold from a converged
 * run; the module's law: never re-derive physics). The calibration
 * anchor for the ceiling-margin knob's forgiving end
 * (applyCeilingMargin): a gap within `range` is crossable by a plain
 * grounded tap pressed BEFORE the lip — no coyote timing needed.
 */
export function measureTapArc(C) {
    const level = {
        id: 'probe', size: { width: 60, height: 30 },
        platforms: [{ id: 'a', x: 0, y: 0, w: 60, h: 1, type: 'ground' }],
        hazards: [], pickups: [], portals: [], spawn: { x: 1, y: 1 },
    };
    let s = {
        x: 20, y: 1, vx: C.maxSpeed, vy: 0, facing: 1, desiredJump: false,
        pressingJump: false, jumpBufferCounter: 0, coyoteTimeCounter: 0,
        currentlyJumping: false, canJumpAgain: false, gravityScale: 1,
        gravMultiplier: 1, onGround: true, t: 0, landedOn: null,
        standingOn: 'a', touchedPickups: [], touchedPortals: [],
        hits: 0, respawned: null,
    };
    let apex = 1;
    let launchX = null;
    let landX = null;
    for (let i = 1; i <= 300; i++) {
        s = physicsStep(s, i === 1 ? { jump: true } : null, level, {}, C);
        if (launchX === null && !s.onGround) launchX = s.x;
        apex = Math.max(apex, s.y);
        if (launchX !== null && s.onGround) { landX = s.x; break; }
    }
    return {
        top: round2(apex - 1 + C.PLAYER_H),
        range: landX === null ? 0 : round2(landX - launchX),
    };
}

/**
 * Profiles whose reach SATURATES the sweep cap (16): the measured
 * horizontal reach exceeds the probe's search ceiling, so the swept
 * REACH values are lower bounds, not measurements — every gate window
 * derived from them (DJ_GAP, STONE) is UNVERIFIABLE there. The sphere
 * grower's exitGateVeto refuses physics gates on these profiles rather
 * than emit unverifiable specs (plan §4.9 calibration constraints);
 * raising the cap and re-deriving the windows would unlock them.
 * Membership is pinned (static profile data) and re-asserted by a
 * sweep in generator.slow.test.js.
 */
export const SWEEP_SATURATING_PROFILES = Object.freeze(['sonic', 'meatboy']);

/**
 * Pinned geometry for the default (celeste) profile. REACH values are
 * the sweepMaxGap results (single 6.69 incl. coyote; dj 11.40);
 * windows leave margin on BOTH sides of every gate boundary so the
 * solver's arrival/trigger grids can't flip a verdict (§4.3 doctrine).
 */
export const CELESTE_GEOMETRY = Object.freeze({
    REACH: Object.freeze({
        single: 6.69, dj: 11.4, spring: 13.49, singleUp: 6.15, singleUpRamp: 5.93,
    }),
    //                          (sweepMaxGap / sweepSpringTotal, SPRING_RISE 10;
    //                           singleUp/singleUpRamp = sweepMaxGap at
    //                           dy JITTER_MAX / RAMP_STEP max)
    SEG_W: Object.freeze({ min: 5, span: 2.5 }),        // ≫ run-up convergence (~0.5);
    //                          kept tight — floor width scales the solver's arrival grid
    RUN_GAP: Object.freeze({ min: 2.3, span: 1.3 }),    // max 3.6 ≪ single 6.69
    DJ_GAP: Object.freeze({ min: 7.4, span: 2.4 }),     // > single+0.7; max 9.8 ≤ dj−1.6
    STONE_W: 5,
    STONE_HALF: Object.freeze({ min: 3.5, span: 0.7 }), // total ≥ 12 > dj+0.5; half ≤ 4.2
    SPRING_W: 4,
    SPRING_NEAR: Object.freeze({ min: 3.5, span: 0.7 }), // jump-down onto the spring;
    //                          max 4.2 ≤ 0.75 × single (grounded window, like STONE_HALF)
    SPRING_TOTAL: Object.freeze({ min: 11.95, span: 1.05 }), // ≥ dj+0.55 (dj-proof);
    //                          max 13.0 ≤ spring reach 13.49 − 0.49 (bounce carries it)
    BRANCH_GAP: Object.freeze({ min: 4.1, span: 0.8 }), // tip side clearance > PLAYER_W
    //                          (adjacent goal corridors overhang 0.75); max 4.9 ≪ single
    TIP_W: 2.5,
    TIP_H: 0.5,
    BRANCH_RISE: 1.35,                                  // 0.6 × jumpHeight (tip top; apex 2.25 clears)
    HAZARD_MARGIN: 2,                                   // spike patch inset from segment edges
    // ── reward shelves (plan §8.7 step 2) — a one-way shelf hung in a
    //    gate's descent corridor. RISE values are sweepMaxRise results
    //    (max LANDABLE rise, coyote/arc-entry inclusive); rises are
    //    measured shelf-TOP above the floors' top (y=1). Descent-band
    //    measurements: spring bounce arcs cross shelf heights 7-8.5
    //    at x ∈ [3.4, 7.8] rel. to the spring's left edge; dj arcs
    //    track the far lip (max descent x ≈ 9.9 rel. to gap start
    //    across the whole DJ_GAP window). ──
    RISE: Object.freeze({ single: 2.45, dj: 4.71 }),    // swept (sweepMaxRise)
    SHELF_H: 0.5,
    SHELF_W: Object.freeze({ min: 5.2, span: 0.8 }),    // spans the descent band
    SPRING_SHELF_RISE: Object.freeze({ min: 6, span: 1.5 }), // > dj rise + 1.29 (dj-proof);
    //                          top ≤ bounce apex 9.5 − 2 (catch while still falling)
    SPRING_SHELF_DX: Object.freeze({ min: 2.9, span: 0.4 }), // shelf left rel spring left,
    //                          just left of the measured descent band
    DJ_SHELF_RISE: Object.freeze({ min: 3.1, span: 1.1 }),   // > single rise + 0.65; ≤ dj − 0.5
    DJ_SHELF_BACK: Object.freeze({ min: 1.5, span: 0.4 }),   // shelf left = gap width − back
    SHELF_PAD: 3.7,       // extra landing-floor width under the fall-off drift
    SAW_CHANCE: 0.5,      // saw under a shelf's right half (§8.4 flavor)
    SAW_W: 1.1,
    SAW_H: 1,
    DJ_SAW_MIN_RISE: 2.98, // PLAYER_H + 0.3 corridor clearance + SHELF_H
    //                        + 0.05 hang + SAW_H — dj shelves hang low,
    //                        so their saw is rise-guarded (§8.7 step 3)
    // ── vertical jitter (placement step 1) — plain floors rise
    //    0..jitter×JITTER_MAX above the base line; gate/branch/exit/
    //    entrance floors stay base-anchored (the gap windows are
    //    calibrated flat). Cap sized so a max-rise run-gap crossing
    //    keeps margin even at gapMargin 1: RUN_GAP's structural cap
    //    (0.75×single = 5.02) ≤ singleUp 6.15 − 0.5. ──
    JITTER_MAX: 1.2,
    // ── split segments (placement steps 2+3) — a gradual ramp climbs
    //    RAMP_STEP per floor, then the route forks: jump → a one-way
    //    TOP lane (drop-through, §8.6), no jump / drop → walk off the
    //    split floor onto the base-height bottom floor, which also
    //    catches the top lane's fall-off merge. Requirement-neutral by
    //    construction (both lanes plain — the OR-logic tier is §8.7
    //    step 6). singleUpRamp = sweepMaxGap at dy RAMP_STEP max. ──
    RAMP_GAP: Object.freeze({ min: 2.3, span: 0.7 }),   // ≤ singleUpRamp 5.93 − 2.4
    RAMP_STEP: Object.freeze({ min: 1.2, span: 0.3 }),  // ≤ single rise 2.45 − 0.95
    RAMP_W: Object.freeze({ min: 4, span: 1.5 }),
    TOP_RISE: Object.freeze({ min: 1, span: 0.5 }),     // top lane above the split floor
    TOP_GAP: Object.freeze({ min: 1.5, span: 1 }),
    TOP_W: Object.freeze({ min: 8, span: 3 }),
    // ── ceiling hazards (§8.7 step 3) — a kill slab hung over its own
    //    pinned run gap: full-height jumps clip it, coyote-tap arcs
    //    cross underneath. The gap window is PINNED calibration (never
    //    stretched by gapMargin), max 2.8 — the celeste edge of
    //    lattice-robust crossings (sweepCeilingMin: 1.59 at ≤ 2.8,
    //    2.81 at 3.0). CEIL_MIN_CLEAR is that swept measurement; the
    //    rise window sits ≥ 0.5 above it and ≥ 0.44 below the
    //    full-hold player top (~3.49 = 1.05×jumpHeight + PLAYER_H),
    //    so the punishment is real and the crossing has margin. The
    //    slab is thick enough that dj arcs cannot overfly it. ──
    CEIL_GAP: Object.freeze({ min: 2.3, span: 0.5 }),
    CEIL_MIN_CLEAR: 1.59,                               // sweepCeilingMin at CEIL_GAP max
    CEIL_RISE: Object.freeze({ min: 2.1, span: 0.95 }), // slab bottom above floor top
    CEIL_OVER: 1.5,                                     // slab overhang past each lip
    CEIL_H: 4.5,                                        // ≥ dj apex top − rise min + margin
    TAP: Object.freeze({ top: 1.87, range: 1.62 }),     // measureTapArc — the grounded-tap
    //                        arc anchoring applyCeilingMargin's forgiving end (the robust
    //                        swept min at tap-crossable gaps is ~TAP.top: 1.86 at gap ≤ 1.3)
    // ── glide gate (§8.7 step 4) — a 3-step ramp (RAMP_* windows; the
    //    pad rise reuses RAMP_STEP: one more step up, but one-way) to a
    //    `glider` pad over an extra-wide DROP chasm. All bounds are
    //    sweepGlideChasm results in the DRAWN coordinate (pad right
    //    edge → landing floor): GLIDE_DJ_MAX at the worst case (max
    //    ramp step, MIN pad extents — the landing floor nearest the
    //    suppressed pad's ramp), GLIDE_REACH across the pad-rise
    //    window. The landing floor is widened by GLIDE_LAND_PAD so the
    //    longest glide (reach at max rise) still lands ON it — the
    //    containment guarantee that a glide can never overfly a later
    //    gate. ──
    GLIDE_STEPS: 3,
    GLIDE_PAD_GAP: Object.freeze({ min: 1.4, span: 0.4 }), // pad left rel ramp-top right
    GLIDE_PAD_W: Object.freeze({ min: 5, span: 1 }),
    GLIDE_GAP: Object.freeze({ min: 8, span: 4.5 }),    // > dj 6.29 + 1.7; max 12.5 ≤ 16.43 − 3.9
    GLIDE_DJ_MAX: 6.29,                                 // sweepGlideChasm {doubleJump}, min extents
    GLIDE_REACH: Object.freeze({ min: 16.43, max: 17.87 }), // {glide} at pad rise 1.2 / 1.5
    GLIDE_LAND_PAD: 11.4,                               // GLIDE_REACH.max − GLIDE_GAP.min + 1.5
});

/**
 * Derive a profile's generator geometry from its physics constants.
 * Horizontal reaches are swept with the solver unless supplied via
 * `opts.reaches` (tests; pinned profiles never call this). EXPENSIVE
 * when it sweeps (~10s per profile) — generation-time only, and only
 * for profiles without pinned geometry.
 */
export function deriveGeometry(C, opts = {}) {
    const single = opts.reaches?.single
        ?? sweepMaxGap(C, { doubleJump: false, blue: false }, opts);
    const dj = opts.reaches?.dj
        ?? sweepMaxGap(C, { doubleJump: true, blue: false }, opts);
    const spring = opts.reaches?.spring ?? sweepSpringTotal(C, opts);
    const riseSingle = opts.rises?.single ?? sweepMaxRise(C, { doubleJump: false });
    const riseDj = opts.rises?.dj ?? sweepMaxRise(C, { doubleJump: true });
    // jitter cap ~half the landable rise, then measure the up-crossing
    // reach at that cap (the RUN_GAP safety bound)
    const jitterMax = round1(0.5 * riseSingle);
    const singleUp = opts.reaches?.singleUp
        ?? sweepMaxGap(C, { doubleJump: false, blue: false }, { ...opts, dy: jitterMax });
    // split-segment windows scale off the landable single rise; the
    // ramp's up-crossing bound is swept at the max ramp step
    const rampStepMin = round1(0.49 * riseSingle);
    const rampStepMax = round1(rampStepMin + 0.12 * riseSingle);
    const singleUpRamp = opts.reaches?.singleUpRamp
        ?? sweepMaxGap(C, { doubleJump: false, blue: false }, { ...opts, dy: rampStepMax });
    // run-up convergence distance (moveTowards is linear in v):
    // t = maxSpeed/maxAcceleration, dist = maxSpeed²/(2·maxAcceleration)
    const convergence = (C.maxSpeed * C.maxSpeed) / (2 * C.maxAcceleration);
    const STONE_W = 5;
    const TIP_W = 2.5;
    const djMargin = 0.15 * (dj - single);
    const halfMin = round1((dj * 1.06 - STONE_W) / 2);
    const springTotalMin = round1(dj + 0.55);
    // Shelf windows (§8.7 step 2). The spring-shelf drift bounds come
    // from the deterministic bounce arc: t up = launch/cut-gravity,
    // t down to the shelf top under the downward multiplier, horizontal
    // ≈ maxSpeed (air accel converges fast). Closed-form is generous
    // here — the per-proposal solver verify is the gatekeeper; these
    // windows only set the proposal distribution.
    const gUp = (2 * C.jumpHeight) / (C.timeToJumpApex * C.timeToJumpApex);
    const gCut = gUp * (C.variablejumpHeight ? C.jumpCutOff : C.upwardMovementMultiplier);
    const gDown = gUp * C.downwardMovementMultiplier;
    const tUp = Math.sqrt((2 * C.SPRING_RISE) / gCut);
    const tDown = (drop) => Math.sqrt((2 * Math.max(drop, 0.2)) / gDown);
    const springShelfMin = round1(riseDj + 1);
    const springShelfMax = round1(C.SPRING_RISE - 2.5); // top = 1+rise ≤ apex 0.5+RISE − 2
    // drift at the window ends (highest shelf catches earliest)
    const driftHi = C.maxSpeed * (tUp + tDown(C.SPRING_RISE - 0.5 - springShelfMax));
    const driftLo = C.maxSpeed * (tUp + tDown(C.SPRING_RISE - 0.5 - springShelfMin));
    const shelfDxMin = round1(0.65 * driftHi);
    const djShelfMin = round1(riseSingle + 0.65);
    const djShelfSpan = round1(Math.max(0.3, riseDj - 0.5 - djShelfMin));
    const shelfWMin = round1(Math.max(5, 4 + driftLo - shelfDxMin));
    const segWMin = Math.max(5, round1(convergence * 1.5));
    const shelfPad = round1(C.maxSpeed * tDown(springShelfMax) + 1.6);
    // dj-shelf back window: the shelf may overhang the gap freely to
    // its left, so on floaty profiles (long fall drift, wide derived
    // shelves) the BACK offset absorbs the width growth — solve the
    // fall-off containment for the minimum back that keeps the landing
    // on the padded floor (validateGeometry's own inequality, +0.1
    // rounding slack; floor 1.5 = the measured celeste window).
    const djFallDrift = C.maxSpeed
        * Math.sqrt((2 * (djShelfMin + djShelfSpan)) / gDown);
    const djBackMin = Math.max(1.5, round1(
        (shelfWMin + 0.8) - (segWMin + shelfPad - djFallDrift - 1.6)));
    // Ceiling windows (§8.7 step 3). The gap window scales like
    // RUN_GAP's floor (0.35 × single); the slab-bottom window sits
    // between the swept crossing minimum (+0.5) and the full-hold
    // player top (measured overshoot ~5% of jumpHeight; −0.4). A
    // profile whose window collapses REFUSES ceilings (CEIL_RISE
    // null — the proposers plant none there): nsmbu's floaty taps
    // are one (its swept min nearly reaches its full-hold top).
    const ceilGap = Object.freeze({
        min: round1(0.35 * single),
        span: round1(0.07 * single),
    });
    const ceilMinClear = opts.ceils?.min
        ?? sweepCeilingMin(C, round2(ceilGap.min + ceilGap.span));
    const fullTop = 1.05 * C.jumpHeight + C.PLAYER_H;
    const ceilRiseMin = ceilMinClear === null
        ? null : round2(Math.max(ceilMinClear + 0.5, C.PLAYER_H + 0.8));
    const ceilRiseSpan = ceilRiseMin === null
        ? null : round2(fullTop - 0.4 - ceilRiseMin);
    const ceilRise = (ceilRiseSpan !== null && ceilRiseSpan >= 0.25)
        ? Object.freeze({ min: ceilRiseMin, span: ceilRiseSpan }) : null;
    // Glide-gate windows (§8.7 step 4). The dj bound is swept at the
    // WORST case (max ramp step, min pad extents); the glide reach at
    // both ends of the pad-rise window (= RAMP_STEP, reused). Profiles
    // whose window collapses (or whose approach fails outright, e.g.
    // saturating sweeps returning null) REFUSE glide gates: GLIDE_GAP
    // null, and generateLevel throws on a glide requirement there.
    const glideDj = opts.glides?.dj ?? sweepGlideChasm(C, { doubleJump: true },
        { step: rampStepMax, padGap: 1.4, padW: 5 });
    const glideLo = opts.glides?.lo ?? sweepGlideChasm(C, { glide: true },
        { step: rampStepMax, padRise: rampStepMin, padGap: 1.4, padW: 5 });
    const glideHi = opts.glides?.hi ?? sweepGlideChasm(C, { glide: true },
        { step: rampStepMax, padRise: rampStepMax, padGap: 1.8, padW: 6 });
    const glideGapMin = glideDj === null
        ? null : round1(glideDj + Math.max(0.6, 0.27 * glideDj));
    const glideGapMax = (glideGapMin === null || glideLo === null)
        ? null : round1(Math.min(glideLo - 1.5, glideGapMin + 4.5));
    const glideGap = (glideGapMax !== null && glideGapMax - glideGapMin >= 0.5)
        ? Object.freeze({ min: glideGapMin, span: round1(glideGapMax - glideGapMin) })
        : null;
    return Object.freeze({
        REACH: Object.freeze({ single, dj, spring, singleUp, singleUpRamp }),
        RISE: Object.freeze({ single: riseSingle, dj: riseDj }),
        JITTER_MAX: jitterMax,
        RAMP_GAP: Object.freeze({
            min: 2.3, span: round1(Math.max(0.3, Math.min(0.7, singleUpRamp - 0.5 - 2.3))),
        }),
        RAMP_STEP: Object.freeze({
            min: rampStepMin, span: round1(rampStepMax - rampStepMin),
        }),
        RAMP_W: Object.freeze({ min: 4, span: 1.5 }),
        TOP_RISE: Object.freeze({ min: round1(0.41 * riseSingle), span: 0.5 }),
        TOP_GAP: Object.freeze({ min: 1.5, span: 1 }),
        TOP_W: Object.freeze({ min: 8, span: 3 }),
        SHELF_H: 0.5,
        SHELF_W: Object.freeze({ min: shelfWMin, span: 0.8 }),
        SPRING_SHELF_RISE: Object.freeze({
            min: springShelfMin,
            span: round1(Math.max(0.3, springShelfMax - springShelfMin)),
        }),
        SPRING_SHELF_DX: Object.freeze({ min: shelfDxMin, span: 0.4 }),
        DJ_SHELF_RISE: Object.freeze({
            min: djShelfMin,
            span: djShelfSpan,
        }),
        DJ_SHELF_BACK: Object.freeze({ min: djBackMin, span: 0.4 }),
        SHELF_PAD: shelfPad,
        SAW_CHANCE: 0.5,
        SAW_W: 1.1,
        SAW_H: 1,
        DJ_SAW_MIN_RISE: round2(C.PLAYER_H + 0.3 + 0.5 + 0.05 + 1),
        SEG_W: Object.freeze({ min: segWMin, span: 2.5 }),
        RUN_GAP: Object.freeze({ min: round1(0.35 * single), span: round1(0.2 * single) }),
        DJ_GAP: Object.freeze({
            min: round1(single + djMargin),
            span: round1(Math.max(0.5, dj - single - 2 * djMargin - 0.5)),
        }),
        STONE_W,
        STONE_HALF: Object.freeze({
            min: halfMin,
            span: round1(Math.max(0.2, Math.min(0.1 * single, 0.75 * single - halfMin))),
        }),
        SPRING_W: 4,
        SPRING_NEAR: Object.freeze({
            min: round1(Math.min(0.52 * single, 0.75 * single - 0.7)),
            span: 0.7,
        }),
        SPRING_TOTAL: Object.freeze({
            min: springTotalMin,
            span: round1(Math.max(0.3, spring - 0.45 - springTotalMin)),
        }),
        BRANCH_GAP: Object.freeze({ min: round1(TIP_W + 2 * (C.PLAYER_W + 0.05)), span: 0.8 }),
        TIP_W,
        TIP_H: 0.5,
        BRANCH_RISE: round1(0.6 * C.jumpHeight),
        HAZARD_MARGIN: 2,
        CEIL_GAP: ceilGap,
        CEIL_MIN_CLEAR: ceilMinClear,
        CEIL_RISE: ceilRise,
        CEIL_OVER: 1.5,
        CEIL_H: ceilRise === null
            ? null : round1(Math.max(4.5, 2.1 * C.jumpHeight + C.PLAYER_H + 0.5 - ceilRise.min)),
        TAP: Object.freeze(opts.tap ?? measureTapArc(C)),
        GLIDE_STEPS: 3,
        GLIDE_PAD_GAP: Object.freeze({ min: 1.4, span: 0.4 }),
        GLIDE_PAD_W: Object.freeze({ min: 5, span: 1 }),
        GLIDE_GAP: glideGap,
        GLIDE_DJ_MAX: glideDj,
        GLIDE_REACH: (glideLo !== null && glideHi !== null)
            ? Object.freeze({ min: glideLo, max: glideHi }) : null,
        GLIDE_LAND_PAD: glideGap === null ? null : round1(glideHi - glideGap.min + 1.5),
    });
}

/**
 * Structural constraints geometry must satisfy under its constants —
 * checked for pinned and derived geometry alike (tests); returns a
 * list of violation strings, empty = valid. Every gate window must be
 * unclearable by the weaker capability WITH margin and clearable by
 * the stronger one WITH margin (the swept REACH values are the
 * boundary).
 */
export function validateGeometry(G, C) {
    const errors = [];
    const R = G.REACH;
    const wMax = (w) => w.min + w.span;
    if (wMax(G.RUN_GAP) > 0.75 * R.single) {
        errors.push(`RUN_GAP max ${wMax(G.RUN_GAP)} > 75% of single reach ${R.single}`);
    }
    if (G.DJ_GAP.min < R.single + 0.5) {
        errors.push(`DJ_GAP min ${G.DJ_GAP.min} clearable without doubleJump (single ${R.single})`);
    }
    if (wMax(G.DJ_GAP) > R.dj - 0.5) {
        errors.push(`DJ_GAP max ${wMax(G.DJ_GAP)} not clearable with doubleJump (dj ${R.dj})`);
    }
    if (2 * G.STONE_HALF.min + G.STONE_W < R.dj + 0.5) {
        errors.push(`stone gap total ${2 * G.STONE_HALF.min + G.STONE_W} clearable`
            + ` with doubleJump (dj ${R.dj})`);
    }
    if (wMax(G.STONE_HALF) > 0.75 * R.single) {
        errors.push(`STONE_HALF max ${wMax(G.STONE_HALF)} > 75% of single reach ${R.single}`);
    }
    if (G.SPRING_TOTAL.min < R.dj + 0.5) {
        errors.push(`SPRING_TOTAL min ${G.SPRING_TOTAL.min} clearable`
            + ` with doubleJump (dj ${R.dj})`);
    }
    if (wMax(G.SPRING_TOTAL) > R.spring - 0.4) {
        errors.push(`SPRING_TOTAL max ${wMax(G.SPRING_TOTAL)} not clearable`
            + ` via the spring bounce (spring reach ${R.spring})`);
    }
    if (wMax(G.SPRING_NEAR) > 0.75 * R.single) {
        errors.push(`SPRING_NEAR max ${wMax(G.SPRING_NEAR)} > 75% of single reach ${R.single}`);
    }
    if (G.SPRING_TOTAL.min - wMax(G.SPRING_NEAR) - G.SPRING_W < 1) {
        errors.push('SPRING far half can collapse below 1'
            + ` (total min ${G.SPRING_TOTAL.min}, near max ${wMax(G.SPRING_NEAR)},`
            + ` spring w ${G.SPRING_W})`);
    }
    if (G.BRANCH_GAP.min < G.TIP_W + 2 * C.PLAYER_W) {
        errors.push(`BRANCH_GAP min ${G.BRANCH_GAP.min} leaves tip (w ${G.TIP_W})`
            + ' inside an adjacent goal corridor overhang');
    }
    if (wMax(G.BRANCH_GAP) > 0.75 * R.single) {
        errors.push(`BRANCH_GAP max ${wMax(G.BRANCH_GAP)} > 75% of single reach ${R.single}`);
    }
    if (G.BRANCH_RISE > 0.8 * C.jumpHeight) {
        errors.push(`BRANCH_RISE ${G.BRANCH_RISE} above 80% of jump rise ${C.jumpHeight}`);
    }
    const convergence = (C.maxSpeed * C.maxSpeed) / (2 * C.maxAcceleration);
    if (G.SEG_W.min < convergence * 1.2) {
        errors.push(`SEG_W min ${G.SEG_W.min} below run-up convergence ${round2(convergence)}`);
    }
    // ── reward-shelf windows (§8.7 step 2): each gate direction with
    //    margin against the SWEPT rises, and the fall-off must land on
    //    the padded floor after the gate. ──
    if (G.DJ_SHELF_RISE.min < G.RISE.single + 0.4) {
        errors.push(`DJ_SHELF_RISE min ${G.DJ_SHELF_RISE.min} landable without`
            + ` doubleJump (single rise ${G.RISE.single})`);
    }
    if (wMax(G.DJ_SHELF_RISE) > G.RISE.dj - 0.4) {
        errors.push(`DJ_SHELF_RISE max ${wMax(G.DJ_SHELF_RISE)} not catchable`
            + ` by dj arcs (dj rise ${G.RISE.dj})`);
    }
    if (G.SPRING_SHELF_RISE.min < G.RISE.dj + 0.8) {
        errors.push(`SPRING_SHELF_RISE min ${G.SPRING_SHELF_RISE.min} landable`
            + ` with doubleJump (dj rise ${G.RISE.dj})`);
    }
    // shelf top (floors top 1 + rise) vs bounce apex (spring top 0.5 +
    // SPRING_RISE): the arc must still be FALLING with room to spare
    if (wMax(G.SPRING_SHELF_RISE) > C.SPRING_RISE - 2.4) {
        errors.push(`SPRING_SHELF_RISE max ${wMax(G.SPRING_SHELF_RISE)} too close`
            + ` to the bounce apex (SPRING_RISE ${C.SPRING_RISE})`);
    }
    if (G.SHELF_W.min < 5) {
        errors.push(`SHELF_W min ${G.SHELF_W.min} too narrow for the descent band`);
    }
    // fall-off containment: worst shelf overhang past the landing
    // floor's start + the fall drift must land within SEG_W.min + PAD
    const gUp = (2 * C.jumpHeight) / (C.timeToJumpApex * C.timeToJumpApex);
    const gDown = gUp * C.downwardMovementMultiplier;
    const fallDrift = (rise) => C.maxSpeed * Math.sqrt((2 * rise) / gDown);
    const springFloorStart = G.SPRING_TOTAL.min - wMax(G.SPRING_NEAR); // rel spring left
    const springOverhang = wMax(G.SPRING_SHELF_DX) + wMax(G.SHELF_W) - springFloorStart;
    if (G.SEG_W.min + G.SHELF_PAD
            < springOverhang + fallDrift(wMax(G.SPRING_SHELF_RISE)) + 1.5) {
        errors.push('spring shelf fall-off can overshoot the padded landing floor');
    }
    const djOverhang = wMax(G.SHELF_W) - G.DJ_SHELF_BACK.min; // rel far lip
    if (G.SEG_W.min + G.SHELF_PAD
            < djOverhang + fallDrift(wMax(G.DJ_SHELF_RISE)) + 1.5) {
        errors.push('dj shelf fall-off can overshoot the padded landing floor');
    }
    // ── vertical jitter: a run gap must stay crossable when its landing
    //    floor sits JITTER_MAX higher — even at applyGapMargin's cap
    //    (0.75 × single), which is where the two knobs compose. ──
    if (G.JITTER_MAX > 0.75 * R.single - 1) {
        errors.push(`JITTER_MAX ${G.JITTER_MAX} out of scale with single reach ${R.single}`);
    }
    if (0.75 * R.single > R.singleUp - 0.5) {
        errors.push(`RUN_GAP cap ${round2(0.75 * R.single)} not up-crossable at`
            + ` JITTER_MAX (singleUp ${R.singleUp})`);
    }
    // ── split segments: ramp hops must stay crossable at the max step,
    //    rises landable with margin, and the top lane must leave head
    //    clearance over the bottom lane at the SHALLOWEST ramp. ──
    if (wMax(G.RAMP_GAP) > R.singleUpRamp - 0.5) {
        errors.push(`RAMP_GAP max ${wMax(G.RAMP_GAP)} not up-crossable at RAMP_STEP`
            + ` max (singleUpRamp ${R.singleUpRamp})`);
    }
    if (wMax(G.RAMP_STEP) > G.RISE.single - 0.9) {
        errors.push(`RAMP_STEP max ${wMax(G.RAMP_STEP)} too close to the landable`
            + ` single rise ${G.RISE.single}`);
    }
    if (wMax(G.TOP_RISE) > G.RISE.single - 0.8) {
        errors.push(`TOP_RISE max ${wMax(G.TOP_RISE)} too close to the landable`
            + ` single rise ${G.RISE.single}`);
    }
    // top lane underside (2 ramp steps + top rise − lane thickness 0.5)
    // over the bottom floor's standing band
    if (2 * G.RAMP_STEP.min + G.TOP_RISE.min - 0.5 < C.PLAYER_H + 1.4) {
        errors.push('split top lane leaves no head clearance over the bottom lane');
    }
    // dj-shelf saw guard: the pinned threshold must keep the saw's
    // underside out of the landing floor's run corridor with margin
    if (G.DJ_SAW_MIN_RISE !== undefined
            && G.DJ_SAW_MIN_RISE < C.PLAYER_H + 0.3 + G.SHELF_H + 0.05 + G.SAW_H - 0.01) {
        errors.push(`DJ_SAW_MIN_RISE ${G.DJ_SAW_MIN_RISE} lets a dj-shelf saw `
            + 'intrude on the landing corridor');
    }
    // ── ceiling hazards (§8.7 step 3): the slab-bottom window must
    //    clear the swept crossing minimum AND the run corridor with
    //    margin, stay below the full-hold player top (else the slab
    //    punishes nothing), and be thick enough that dj arcs cannot
    //    overfly it. A profile may refuse ceilings (CEIL_RISE null —
    //    the window collapsed); then nothing here applies. ──
    if (G.CEIL_RISE) {
        const fullTop = 1.05 * C.jumpHeight + C.PLAYER_H;
        if (wMax(G.CEIL_GAP) > 0.75 * R.single) {
            errors.push(`CEIL_GAP max ${wMax(G.CEIL_GAP)} > 75% of single reach ${R.single}`);
        }
        if (G.CEIL_MIN_CLEAR === null || G.CEIL_RISE.min < G.CEIL_MIN_CLEAR + 0.4) {
            errors.push(`CEIL_RISE min ${G.CEIL_RISE.min} too close to the swept`
                + ` crossing minimum ${G.CEIL_MIN_CLEAR}`);
        }
        if (G.CEIL_RISE.min < C.PLAYER_H + 0.8) {
            errors.push(`CEIL_RISE min ${G.CEIL_RISE.min} intrudes on the run`
                + ` corridor (PLAYER_H ${C.PLAYER_H})`);
        }
        if (wMax(G.CEIL_RISE) > fullTop - 0.3) {
            errors.push(`CEIL_RISE max ${wMax(G.CEIL_RISE)} above the full-hold`
                + ` player top ${round2(fullTop)} — the slab punishes nothing`);
        }
        if (G.CEIL_RISE.min + G.CEIL_H < 2.1 * C.jumpHeight + C.PLAYER_H + 0.4) {
            errors.push(`CEIL_H ${G.CEIL_H} too thin — double-jump arcs can overfly`
                + ' the slab at its lowest hang');
        }
        if (!(G.TAP?.top > 0) || !(G.TAP?.range > 0)) {
            errors.push('TAP anchor missing — applyCeilingMargin cannot place its'
                + ' forgiving end');
        }
    }
    // ── glide gate (§8.7 step 4): the chasm must be dj-proof with
    //    margin against the SWEPT worst case, comfortably inside the
    //    glide reach, and the widened landing floor must contain the
    //    longest glide (the no-overfly guarantee). A profile may
    //    refuse glide gates (GLIDE_GAP null); then nothing applies. ──
    if (G.GLIDE_GAP) {
        if (G.GLIDE_DJ_MAX === null || G.GLIDE_GAP.min < G.GLIDE_DJ_MAX + 0.5) {
            errors.push(`GLIDE_GAP min ${G.GLIDE_GAP.min} too close to the swept`
                + ` double-jump bound ${G.GLIDE_DJ_MAX}`);
        }
        if (!G.GLIDE_REACH || wMax(G.GLIDE_GAP) > G.GLIDE_REACH.min - 1) {
            errors.push(`GLIDE_GAP max ${wMax(G.GLIDE_GAP)} not glidable with margin`
                + ` (glide reach ${G.GLIDE_REACH?.min})`);
        }
        if (G.GLIDE_REACH
                && G.GLIDE_LAND_PAD < G.GLIDE_REACH.max - G.GLIDE_GAP.min + 1.2) {
            errors.push('glide landing floor cannot contain the longest glide'
                + ` (pad ${G.GLIDE_LAND_PAD}, reach ${G.GLIDE_REACH.max},`
                + ` gap min ${G.GLIDE_GAP.min})`);
        }
        // the pad rise reuses RAMP_STEP, whose landability the ramp
        // constraints above already assert
    }
    return errors;
}

// Per-profile pinned geometry; profiles absent here derive (and sweep)
// from their constants.
const GEOMETRIES = Object.freeze({ celeste: CELESTE_GEOMETRY });

/**
 * Resolve a generator `physics` option to { profileId, C, G }.
 * Accepts a profile id (default DEFAULT_PROFILE_ID) or an explicit
 * { constants, geometry } object (tests, custom profiles).
 */
export function resolveGenPhysics(physics = DEFAULT_PROFILE_ID) {
    if (typeof physics === 'string') {
        const profile = PROFILES[physics];
        if (!profile) throw new Error(`runner generator: unknown physics profile '${physics}'`);
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

// ── Proposal ────────────────────────────────────────────────────────

const GATEABLE = new Set(['doubleJump', 'blue', 'spring', 'glide']);

/** Gates whose descent corridor can carry a reward shelf (§8.7 step
 *  2): the spring bounce and dj arcs rise high enough to catch an
 *  elevated one-way shelf; the stone gate's two low hops do not. */
const SHELF_GATES = new Set(['doubleJump', 'spring']);

/** Default probability that an eligible level/window hangs a reward
 *  shelf over its last gate (both proposers; overridable per call). */
const SHELF_CHANCE_DEFAULT = 0.6;

/** The gate gap kind realising an ability's requirement (one row per
 *  plan-§4.5 gate template; shared by both proposers). */
function gateGapFor(ability) {
    if (ability === 'doubleJump') return { kind: 'dj' };
    if (ability === 'spring') return { kind: 'spring' };
    if (ability === 'glide') return { kind: 'glide' };
    return { kind: 'stone', type: ability };
}

/**
 * Order a level/window's gate abilities, electing at most ONE reward
 * shelf (shared by both proposers — the draw order is part of the
 * byte-identity contract): shuffle, then with probability
 * `shelfChance` move an eligible gate to the END and mark it as the
 * shelf host. Last-gate placement is the nested-chain rule (§8.2):
 * the shelf pickup derives its window's FULL requirement (prefix ∪
 * {gate}) only when no further gate follows. Draws happen ONLY when
 * a shelf is possible (eligible gate + a pickup to host).
 */
function orderGates(rng, abilities, pickupsAvailable, shelfChance) {
    let order = rng.shuffle([...abilities]);
    const eligible = order.filter((a) => SHELF_GATES.has(a));
    let shelfGate = null;
    if (pickupsAvailable && eligible.length > 0 && rng.next() < shelfChance) {
        shelfGate = eligible[Math.floor(rng.next() * eligible.length)];
        order = [...order.filter((a) => a !== shelfGate), shelfGate];
    }
    return { order, shelfGate };
}

function sameSets(minimalSets, want) {
    if (minimalSets.length !== 1) return false;
    const got = minimalSets[0];
    return got.length === want.length && want.every((a) => got.includes(a));
}

const draw = (rng, w) => w.min + rng.next() * w.span;

/**
 * Realize a floor plan left to right — the shared body of proposeLevel
 * and proposeLevelForSpecs. Each plan entry is a floor ({ role, gap,
 * pickupId?, seg← }); `gap` describes the gap BEFORE it ({ kind,
 * type?, portalId?, shelf? }). rng draws happen in strict floor order
 * (gap draws — for 'ceil' gaps width then slab rise — then the gap's
 * shelf draws [rise, width, dx/back, saw], then the floor's width
 * draw) followed by the floor's inline hazard pass — the draw order
 * IS the byte-identity contract. Explicit
 * pickupId/portalId override the loc_N / exit_brN counters (the spec
 * path names its goals); the counters are untouched by overrides only
 * because the two naming schemes are never mixed in one plan.
 *
 * `gap.shelf` ({ pickupId? }, dj/spring gates only) hangs a REWARD
 * SHELF (§8.7 step 2) in the gate's descent corridor: an always-
 * active one-way platform the crossing arc lands on, its pickup in
 * the auto-run wake, the fall-off dropping onto the gate's landing
 * floor (widened by SHELF_PAD and kept hazard-free so the drop is
 * survivable). The detour is refusable by holding drop (§8.6). Spring
 * shelves may hang a saw under their right half (§8.4): off every
 * mandatory trajectory — bounce arcs are caught above it and the
 * fall-off starts right of it — lethal only to a voluntary
 * drop-refusal.
 *
 * VERTICAL JITTER (`jitter` 0..1, placement step 1): plain floors
 * rise 0..jitter×JITTER_MAX above the base line. Only floors whose
 * incoming AND outgoing gaps are plain runs jitter — gate, branch,
 * entrance, and exit floors stay base-anchored because every gate
 * window is calibrated flat (the up-crossing safety bound is
 * REACH.singleUp, validateGeometry). The rise draw happens ONLY when
 * the amplitude is non-zero, so jitter 0 is draw-for-draw identical
 * to the pre-jitter generator (zone tables and default worlds
 * reproduce byte-identically). Floor-relative geometry (goals,
 * hazards, partner floors) rides the floor's rise.
 */
function realizePlan(plan, { rng, G, hazardChance, jitter = 0 }) {
    const jitterAmp = Math.max(0, Math.min(1, jitter)) * G.JITTER_MAX;
    // base-anchor rule: a floor may only rise when nothing calibrated
    // launches from it or lands on it — its own gap AND the next
    // floor's gap must be plain runs, and it must be an interior floor
    const jitterable = (i) => {
        const f = plan[i];
        if (f.role === 'entrance' || f.role === 'exit') return false;
        if (f.gap?.kind !== 'run') return false;
        const next = plan[i + 1];
        return !next || next.gap?.kind === 'run';
    };
    const platforms = [];
    const hazards = [];
    const pickups = [];
    const portals = [];
    let x = 0;
    let segN = 0;
    let stoneN = 0;
    let sprN = 0;
    let shN = 0;
    let brN = 0;
    let pkN = 0;
    let hzN = 0;
    let lnN = 0;
    let pdN = 0;
    // shelf platform + wake pickup; returns the shelf (saw placement)
    const pushShelf = (left, rise, w, spec) => {
        const shelf = {
            id: `shelf${shN++}`, x: left, y: round2(1 + rise - G.SHELF_H),
            w, h: G.SHELF_H, type: 'oneway',
        };
        platforms.push(shelf);
        pickups.push({
            id: spec.pickupId ?? `loc_${pkN++}`, on: shelf.id,
            x: round2(left + w - 0.2), y: round2(1 + rise + 0.6),
        });
        return shelf;
    };
    for (let i = 0; i < plan.length; i++) {
        const f = plan[i];
        // per-gap extra width folded into this entry's floor (split
        // lane coverage; shelves use the constant SHELF_PAD below)
        let gapPad = 0;
        if (f.gap) {
            const g = f.gap;
            if (g.kind === 'run') {
                x = round2(x + draw(rng, G.RUN_GAP));
            } else if (g.kind === 'ceil') {
                // CEILING HAZARD (§8.7 step 3): a kill slab over its
                // own pinned gap (CEIL_GAP never stretches with
                // gapMargin), bottom drawn from the calibrated
                // CEIL_RISE band — full-height jumps clip it, short
                // coyote holds cross underneath. Both flanking floors
                // stay base-anchored (kind ≠ 'run' fails jitterable on
                // both sides) and spike-free (the hazard pass below
                // skips both flanks): the crossing windows are
                // calibrated on flat, unspiked lips.
                const gapW = round2(draw(rng, G.CEIL_GAP));
                const rise = round2(draw(rng, G.CEIL_RISE));
                hazards.push({
                    id: `hz${hzN++}`, type: 'ceiling',
                    x: round2(x - G.CEIL_OVER), y: round2(1 + rise),
                    w: round2(gapW + 2 * G.CEIL_OVER), h: G.CEIL_H,
                });
                x = round2(x + gapW);
            } else if (g.kind === 'split') {
                // SPLIT SEGMENT (placement steps 2+3): a ramp of rising
                // ground floors; the LAST ramp floor is the split — a
                // jump there catches the one-way TOP lane, no jump (or
                // drop, §8.6) walks off onto this entry's floor, which
                // starts flush under the split's right edge at BASE
                // height and runs long enough to catch the top lane's
                // fall-off merge. Requirement-neutral by construction:
                // both lanes are plain geometry, so goals past the
                // merge derive exactly what they would without it (the
                // OR-logic lane tier is §8.7 step 6, not this).
                const steps = 2 + Math.floor(rng.next() * 2);
                let rise = 0;
                for (let r = 0; r < steps; r++) {
                    const gapW = round2(draw(rng, G.RAMP_GAP));
                    rise = round2(rise + draw(rng, G.RAMP_STEP));
                    const w = round2(draw(rng, G.RAMP_W));
                    platforms.push({
                        id: `seg${segN++}`, x: round2(x + gapW), y: rise,
                        w, h: 1, type: 'ground',
                    });
                    x = round2(x + gapW + w);
                }
                const topRise = round2(draw(rng, G.TOP_RISE));
                const topGap = round2(draw(rng, G.TOP_GAP));
                const topW = round2(draw(rng, G.TOP_W));
                platforms.push({
                    id: `lane${lnN++}`, x: round2(x + topGap),
                    y: round2(0.5 + rise + topRise), // top = split top + topRise
                    w: topW, h: 0.5, type: 'oneway',
                });
                // +5 covers the top lane's fall-off drift with margin
                gapPad = round2(topGap + topW + 5);
            } else if (g.kind === 'dj') {
                const gapW = round2(draw(rng, G.DJ_GAP));
                if (g.shelf) {
                    // anchored off the FAR lip: dj descent arcs track
                    // it across the whole DJ_GAP window (max descent
                    // x ≈ gap start + 9.9 regardless of gap width)
                    const rise = round2(draw(rng, G.DJ_SHELF_RISE));
                    const w = round2(draw(rng, G.SHELF_W));
                    const back = round2(draw(rng, G.DJ_SHELF_BACK));
                    const shelf = pushShelf(round2(x + gapW - back), rise, w, g.shelf);
                    // saw under the dj shelf's right half (§8.7 step 3
                    // — deferred from step 2 pending this clearance
                    // guard): dj shelves hang low, so the saw only
                    // appears when the DRAWN rise keeps its underside
                    // out of the landing floor's run corridor with
                    // margin. Off every mandatory trajectory like the
                    // spring saw: crossing arcs that land here are
                    // caught by the shelf ABOVE the saw, slip-under
                    // arcs are grounded before its x-span (celeste's
                    // steep descent), and the fall-off starts right of
                    // it — lethal only to a voluntary drop-refusal.
                    if (rise >= G.DJ_SAW_MIN_RISE && rng.next() < G.SAW_CHANCE) {
                        const lo = shelf.x + 0.55 * w;
                        const hi = shelf.x + w - G.SAW_W - 0.2;
                        hazards.push({
                            id: `hz${hzN++}`, type: 'saw',
                            x: round2(lo + rng.next() * (hi - lo)),
                            y: round2(shelf.y - G.SAW_H - 0.05),
                            w: G.SAW_W, h: G.SAW_H,
                        });
                    }
                }
                x = round2(x + gapW);
            } else if (g.kind === 'stone') {
                const half1 = round2(draw(rng, G.STONE_HALF));
                const half2 = round2(draw(rng, G.STONE_HALF));
                platforms.push({
                    id: `stone${stoneN++}`, x: round2(x + half1), y: 0.5,
                    w: G.STONE_W, h: 0.5, type: g.type,
                });
                x = round2(x + half1 + G.STONE_W + half2);
            } else if (g.kind === 'spring') {
                // The gate invariant is the TOTAL gap (near + spring
                // + far): the jump onto the spring caps the landing
                // depth, so the crossable total is invariant in the
                // split (sweepSpringTotal). Draw the near half (the
                // landability window) and the total; the far half is
                // the difference. Spring top 0.5 below the floors —
                // a jump-down landing, launched back up by the bounce.
                const near = round2(draw(rng, G.SPRING_NEAR));
                const total = round2(draw(rng, G.SPRING_TOTAL));
                const springX = round2(x + near);
                platforms.push({
                    id: `spring${sprN++}`, x: springX, y: 0,
                    w: G.SPRING_W, h: 0.5, type: 'spring',
                });
                if (g.shelf) {
                    const rise = round2(draw(rng, G.SPRING_SHELF_RISE));
                    const w = round2(draw(rng, G.SHELF_W));
                    const dx = round2(draw(rng, G.SPRING_SHELF_DX));
                    const shelf = pushShelf(round2(springX + dx), rise, w, g.shelf);
                    if (rng.next() < G.SAW_CHANCE) {
                        const lo = shelf.x + 0.55 * w;
                        const hi = shelf.x + w - G.SAW_W - 0.2;
                        hazards.push({
                            id: `hz${hzN++}`, type: 'saw',
                            x: round2(lo + rng.next() * (hi - lo)),
                            y: round2(shelf.y - G.SAW_H - 0.05),
                            w: G.SAW_W, h: G.SAW_H,
                        });
                    }
                }
                x = round2(x + total);
            } else if (g.kind === 'glide') {
                // GLIDE GATE (§8.7 step 4): a ramp climbs GLIDE_STEPS
                // ground floors (RAMP windows — the same grammar as
                // splits), then a `glider` pad (existence-gated on the
                // Glide item, one more RAMP_STEP up but one-way) hangs
                // past the ramp top over an extra-wide DROP chasm.
                // Holding jump during the pad walk-off caps fall speed
                // (physics.js) and sails the chasm; without the item
                // the pad is absent and the chasm is dj-proof from the
                // lower ramp top (GLIDE_DJ_MAX). The landing floor is
                // this entry's own floor, widened by GLIDE_LAND_PAD so
                // the longest glide still lands ON it (no-overfly
                // containment) — and kept hazard-free below.
                let rise = 0;
                for (let r = 0; r < G.GLIDE_STEPS; r++) {
                    const stepGap = round2(draw(rng, G.RAMP_GAP));
                    rise = round2(rise + draw(rng, G.RAMP_STEP));
                    const w = round2(draw(rng, G.RAMP_W));
                    platforms.push({
                        id: `seg${segN++}`, x: round2(x + stepGap), y: rise,
                        w, h: 1, type: 'ground',
                    });
                    x = round2(x + stepGap + w);
                }
                const padRise = round2(draw(rng, G.RAMP_STEP));
                const padGap = round2(draw(rng, G.GLIDE_PAD_GAP));
                const padW = round2(draw(rng, G.GLIDE_PAD_W));
                platforms.push({
                    id: `pad${pdN++}`, x: round2(x + padGap),
                    y: round2(rise + 1 + padRise - 0.5), w: padW, h: 0.5, type: 'glider',
                });
                x = round2(x + padGap + padW);
                x = round2(x + draw(rng, G.GLIDE_GAP));
                gapPad = G.GLIDE_LAND_PAD;
            } else if (g.kind === 'branch') {
                const gapW = round2(draw(rng, G.BRANCH_GAP));
                const tipY = round2(1 + G.BRANCH_RISE - G.TIP_H);
                const tip = {
                    id: `tip${brN}`, x: round2(x + (gapW - G.TIP_W) / 2), y: tipY,
                    w: G.TIP_W, h: G.TIP_H, type: 'ground',
                };
                platforms.push(tip);
                // 0.2 in from the tip's right end: interior hosts have
                // no wall clamp, so the wake stand box starts at
                // right − FOOT inset (the pickup offset, not the
                // wall-clamped exit's 0.6)
                portals.push({
                    id: g.portalId ?? `exit_br${brN}`, on: tip.id,
                    x: round2(tip.x + G.TIP_W - 0.2), y: round2(tipY + G.TIP_H + 0.6),
                    arrow: 'up', exitName: null,
                });
                brN++;
                x = round2(x + gapW);
            }
        }
        // vertical jitter: drawn ONLY when active (see the header's
        // byte-identity note) and only for base-anchor-free floors
        const rise = (jitterAmp > 0 && jitterable(i))
            ? round2(rng.next() * jitterAmp) : 0;
        // shelved gates and splits widen their landing floor (the
        // fall-off pad / the two-lane coverage)
        const w = round2(draw(rng, G.SEG_W) + (f.role === 'entrance' ? 2 : 0)
            + (f.gap?.shelf ? G.SHELF_PAD : 0) + gapPad);
        const seg = { id: `seg${segN++}`, x, y: rise, w, h: 1, type: 'ground' };
        platforms.push(seg);
        if (f.role === 'pickup') {
            const pid = f.pickupId ?? `loc_${pkN++}`;
            pickups.push({
                id: pid, on: seg.id, x: round2(x + w - 0.2), y: round2(1.6 + rise),
            });
        }
        f.seg = seg;
        x = round2(x + w);
        // hazard decoration (goal-free plain floors only — and never
        // on a shelf's landing floor, where the fall-off must stay
        // survivable): a spike patch inset from the floor's edges,
        // plus the FLUSH PARTNER floor the hop needs (see the header
        // — a spiked floor must end in a flush crossing, never a
        // jump gap). The partner shares the floor's rise: the hop
        // must land back and RUN off flush, never climb.
        if (f.role === 'plain' && !f.gap?.shelf && f.gap?.kind !== 'split'
                && f.gap?.kind !== 'ceil' && plan[i + 1]?.gap?.kind !== 'ceil'
                && f.gap?.kind !== 'glide' // the glide landing must stay survivable
                && seg.w >= 2 * G.HAZARD_MARGIN + 1.8
                && rng.next() < hazardChance) {
            const hw = round2(1 + rng.next() * 0.6);
            const lo = seg.x + G.HAZARD_MARGIN;
            const hi = seg.x + seg.w - G.HAZARD_MARGIN - hw;
            hazards.push({
                id: `hz${hzN++}`, type: 'spikes',
                x: round2(lo + rng.next() * (hi - lo)), y: round2(1 + rise), w: hw, h: 0.8,
            });
            const partnerW = round2(4 + rng.next() * 2);
            platforms.push({
                id: `seg${segN++}`, x, y: rise, w: partnerW, h: 1, type: 'ground',
            });
            x = round2(x + partnerW);
        }
    }
    return { platforms, hazards, pickups, portals };
}

/**
 * Assemble a realized plan into a level: width from the realized right
 * edges (+0.01 headroom — the rounded cumulative cursor can trail a
 * platform's x+w by float dust, and the validator's bounds check is
 * exact), the wall-clamped exit_main on the LAST floor, spawn at the
 * standard entrance.
 */
function assembleStrip(id, plan, { platforms, hazards, pickups, portals }) {
    const width = round2(Math.max(...platforms.map((p) => p.x + p.w)) + 0.01);
    const last = plan[plan.length - 1].seg;
    portals.push({
        id: 'exit_main', on: last.id, x: round2(width - 0.6),
        y: round2(last.y + last.h + 0.6),
        arrow: 'right', exitName: null,
    });

    return {
        id,
        size: { width, height: 16 },
        platforms, hazards, pickups, portals,
        spawn: { x: 1, y: 1 },
    };
}

/**
 * One proposal — UNVERIFIED geometry (generateLevel is the verified
 * entry; this is exported for tests and the dump CLI's proposal view).
 * Floors are flat ground at y=0 (h=1); gap kinds carry the gate
 * semantics (see realizePlan for the draw-order contract).
 */
export function proposeLevel({
    id, requirement, pickupCount, branchCount, stepsBetween, hazardChance,
    shelfChance = SHELF_CHANCE_DEFAULT, jitter = 0, splitChance = 0,
    ceilingChance = 0, rng, G,
}) {
    // plan: each entry is a floor; `gap` describes the gap BEFORE it.
    const plan = [{ role: 'entrance', gap: null }];
    const plains = () => {
        const n = 1 + Math.floor(rng.next() * stepsBetween);
        for (let i = 0; i < n; i++) plan.push({ role: 'plain', gap: { kind: 'run' } });
        // ceiling hazards and split segments are requirement-neutral
        // texture — placeable in any plains slot; drawn ONLY when the
        // knob is on (byte-identity). A profile whose calibration
        // window collapsed refuses ceilings (CEIL_RISE null).
        if (ceilingChance > 0 && G.CEIL_RISE && rng.next() < ceilingChance) {
            plan.push({ role: 'plain', gap: { kind: 'ceil' } });
        }
        if (splitChance > 0 && rng.next() < splitChance) {
            plan.push({ role: 'plain', gap: { kind: 'split' } });
        }
    };
    // at most one reward shelf, on the LAST gate (orderGates): its
    // pickup then derives exactly [S] like every trunk goal
    const { order, shelfGate } = orderGates(rng, requirement, pickupCount > 0, shelfChance);
    for (const ability of order) {
        plains();
        plan.push({
            role: 'plain',
            gap: { ...gateGapFor(ability), ...(ability === shelfGate ? { shelf: {} } : {}) },
        });
    }
    plains();
    const floorPickups = pickupCount - (shelfGate ? 1 : 0);
    for (let i = 0; i < floorPickups; i++) plan.push({ role: 'pickup', gap: { kind: 'run' } });
    for (let b = 0; b < branchCount; b++) plan.push({ role: 'plain', gap: { kind: 'branch' } });
    plan.push({ role: 'exit', gap: { kind: 'run' } });

    return assembleStrip(id, plan, realizePlan(plan, { rng, G, hazardChance, jitter }));
}

/**
 * Re-derive a level's access rules the way generateLevel verifies them
 * (layered strip reach + goal-host early exit). Exported so tests and
 * the dump CLI verify EXACTLY what the generator gatekept.
 */
export function deriveGeneratedRules(level, C = DEFAULTS) {
    const goalHosts = new Set(
        [...(level.pickups ?? []), ...(level.portals ?? [])].map((g) => g.on));
    return deriveAccessRules(level, {
        constants: C, reach: reachableRunPlatforms, goalHosts,
    });
}

/**
 * Generate one strip whose pickups and EVERY exit (main + branch tips)
 * require EXACTLY `requirement` (an ability-name array ⊆
 * doubleJump/blue). Throws if no proposal verifies within `attempts`.
 */
export function generateLevel({
    id = 'gen',
    requirement = [],
    pickupCount = 1,
    branchCount = 0,
    stepsBetween = 2,
    hazardChance = 0.35,
    shelfChance = SHELF_CHANCE_DEFAULT,
    jitter = 0,
    splitChance = 0,
    ceilingChance = 0,
    ceilingMargin = 1,
    seed = 1,
    attempts = 8,
    physics = DEFAULT_PROFILE_ID,
} = {}) {
    for (const a of requirement) {
        if (!GATEABLE.has(a)) throw new Error(`generateLevel: no gate template for '${a}'`);
    }
    const { profileId, C, G: Gbase } = resolveGenPhysics(physics);
    const G = applyCeilingMargin(Gbase, ceilingMargin);
    if (requirement.includes('glide') && !G.GLIDE_GAP) {
        throw new Error(`generateLevel('${id}'): the '${profileId}' physics profile`
            + ' refuses glide gates (no verifiable chasm window)');
    }
    const want = [...requirement].sort();
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        const level = proposeLevel({
            id, requirement, pickupCount, branchCount, stepsBetween, hazardChance,
            shelfChance, jitter, splitChance, ceilingChance, rng, G,
        });
        const modelErrors = validateLevel(level, C);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveGeneratedRules(level, C);
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const goals = [
            ...level.pickups.map((pk) => derived.pickups[pk.id]),
            ...level.portals.map((pt) => derived.exits[pt.id]),
        ];
        if (goals.every((g) => sameSets(g.minimalSets, want))) return level;
        rejected.push(`attempt ${attempt}: derived rules != [${want.join('+')}]`);
    }
    throw new Error(`generateLevel('${id}'): no valid proposal in ${attempts} attempts`
        + ` (requirement [${want.join('+')}]): ${rejected.join('; ')}`);
}

// ── Spec-driven generation (sphere growth, plan §4.9) ───────────────

/**
 * Widen the plain-run-gap window toward the structural cap
 * (0.75 × single reach — validateGeometry's own bound, which keeps
 * plain gaps grounded-crossable WITHOUT spending the coyote window:
 * the swept reach is coyote-INCLUSIVE, so gaps must never approach it).
 * margin 0 returns G UNCHANGED (byte-identity for default worlds);
 * margin 1 stretches the window max to the cap. Only RUN_GAP moves —
 * gate windows are pinned calibration, never a difficulty knob.
 */
export function applyGapMargin(G, margin = 0) {
    const m = Math.max(0, Math.min(1, margin));
    if (m === 0) return G;
    const cap = 0.75 * G.REACH.single;
    const baseMax = G.RUN_GAP.min + G.RUN_GAP.span;
    const max = Math.min(cap, baseMax + m * (cap - baseMax));
    // floor, not round: a 2dp round-up would nudge the window max past
    // the structural cap and fail validateGeometry
    const span = Math.floor((max - G.RUN_GAP.min) * 100) / 100;
    return Object.freeze({
        ...G,
        RUN_GAP: Object.freeze({ min: G.RUN_GAP.min, span: Math.max(G.RUN_GAP.span, span) }),
    });
}

/**
 * Interpolate the ceiling windows toward the FORGIVING end (§8.7
 * step 3 follow-up, user 2026-07-03: crossing a ceiling must not
 * require coyote timing). margin 1 (the DEFAULT) narrows the gap to
 * grounded-tap range (TAP.range − 0.3, drawn from a 0.3-wide window)
 * and lifts the slab-bottom band above the grounded-tap apex
 * (TAP.top + 0.45) — a plain short hop pressed BEFORE the lip clears
 * it, and coyote time becomes spare forgiveness for late presses
 * instead of a requirement. margin 0 returns G UNCHANGED: the pinned
 * expert windows, where gaps are wide enough that only a run-off
 * coyote tap fits under the slab. The band MAX never moves (mid and
 * full holds stay punished at every margin). A profile whose
 * forgiving band collapses (interpolated span < 0.25, or a tap range
 * too short for any gap) gets CEIL_RISE null — ceilings are refused
 * at that margin, consuming no rng, exactly like the deriveGeometry
 * refusal path.
 */
export function applyCeilingMargin(G, margin = 1) {
    const m = Math.max(0, Math.min(1, margin));
    if (m === 0 || !G.CEIL_RISE) return G;
    const easyGapMax = round2(G.TAP.range - 0.3);
    const easyGapMin = round2(Math.max(0.8, easyGapMax - 0.3));
    const easyRiseMin = round2(G.TAP.top + 0.45);
    const gapMax0 = G.CEIL_GAP.min + G.CEIL_GAP.span;
    const riseMax = round2(G.CEIL_RISE.min + G.CEIL_RISE.span); // pinned: punishment
    const gapMin = round2(G.CEIL_GAP.min + m * (easyGapMin - G.CEIL_GAP.min));
    const gapMax = round2(gapMax0 + m * (easyGapMax - gapMax0));
    const riseMin = round2(G.CEIL_RISE.min + m * (easyRiseMin - G.CEIL_RISE.min));
    if (riseMax - riseMin < 0.25 || easyGapMax < 0.8 || gapMax < gapMin) {
        return Object.freeze({ ...G, CEIL_RISE: null });
    }
    return Object.freeze({
        ...G,
        CEIL_GAP: Object.freeze({ min: gapMin, span: round2(gapMax - gapMin) }),
        CEIL_RISE: Object.freeze({ min: riseMin, span: round2(riseMax - riseMin) }),
    });
}

/**
 * Structural plan for a spec-driven strip (throws, non-retryable —
 * the runner analog of bounce's planBraidGatedChain). A strip realises
 * gates SEQUENTIALLY, so the distinct physics requirements over all
 * goals must form one NESTED CHAIN (∅ ⊂ R1 ⊂ … ⊂ Rk); each goal sits
 * in the window after its requirement's gates and before the next
 * gate, so it derives EXACTLY its requirement. The exit carrying the
 * maximal requirement becomes the wall-clamped exit_main at the strip
 * end; every other exit rides an elevated branch tip in its window
 * (exit_br0..N in spec order) — including any requirement-[] exit,
 * which lands on a tip BEFORE the first gate (this is how the sphere
 * engine's ungated entrance-side back portal is realised: the player
 * spawns past it on the entrance floor and returns to it by choice —
 * a deliberate tip landing — never by the mandatory route's wake).
 *
 * @param {Array<{key: string, requirement: string[]}>} exitSpecs
 * @param {Array<{id: string, requirement: string[]}>} pickupSpecs
 * @returns {{ levels: Array<{ added: string[], pickups: string[],
 *   tips: Array<{key: string, portalId: string}> }>, mainKey: string,
 *   portalByKey: Object<string, string> }}
 */
export function planStripSpecs(exitSpecs = [], pickupSpecs = []) {
    if (exitSpecs.length === 0) {
        throw new Error('runner planStripSpecs: at least one exit spec required');
    }
    const seen = new Set();
    const norm = (req, what) => {
        if (seen.has(what)) throw new Error(`runner planStripSpecs: duplicate goal ${what}`);
        seen.add(what);
        const sorted = [...new Set(req ?? [])].sort();
        for (const a of sorted) {
            if (!GATEABLE.has(a)) {
                throw new Error(`runner planStripSpecs: no gate template for '${a}' (${what})`);
            }
        }
        return sorted;
    };
    const exits = exitSpecs.map((s) => ({ key: s.key, req: norm(s.requirement, `exit '${s.key}'`) }));
    const pickups = pickupSpecs.map((s) => ({ id: s.id, req: norm(s.requirement, `pickup '${s.id}'`) }));

    // Distinct requirement sets (∅ always present — the entrance
    // window), chain-checked smallest to largest.
    const byKey = new Map([['', []]]);
    for (const g of [...exits, ...pickups]) byKey.set(g.req.join('+'), g.req);
    const sets = [...byKey.values()].sort((a, b) => a.length - b.length);
    for (let i = 1; i < sets.length; i++) {
        if (sets[i - 1].length === sets[i].length
                || !sets[i - 1].every((x) => sets[i].includes(x))) {
            throw new Error('runner planStripSpecs: requirements do not form a nested chain '
                + `([${sets[i - 1].join('+')}] vs [${sets[i].join('+')}]) — a strip realises `
                + 'gates sequentially');
        }
    }

    // The strip's right end derives the FULL chain, so the maximal
    // requirement must belong to an exit (the main).
    const top = sets[sets.length - 1];
    const main = exits.find((e) => e.req.length === top.length);
    if (!main) {
        throw new Error(`runner planStripSpecs: the maximal requirement [${top.join('+')}] `
            + 'belongs to no exit — the strip end must be an exit');
    }

    const portalByKey = { [main.key]: 'exit_main' };
    let brN = 0;
    const levels = sets.map((set, i) => {
        const prev = i > 0 ? sets[i - 1] : [];
        const lvlKey = set.join('+');
        const tips = exits
            .filter((e) => e !== main && e.req.join('+') === lvlKey)
            .map((e) => {
                const portalId = `exit_br${brN++}`;
                portalByKey[e.key] = portalId;
                return { key: e.key, portalId };
            });
        return {
            added: set.filter((a) => !prev.includes(a)),
            pickups: pickups.filter((p) => p.req.join('+') === lvlKey).map((p) => p.id),
            tips,
        };
    });
    return { levels, mainKey: main.key, portalByKey };
}

/**
 * One spec-driven proposal — UNVERIFIED geometry (the spec analog of
 * proposeLevel; generateLevelForSpecs is the verified entry). Walks
 * the planStripSpecs levels: per level, gate gaps for the ADDED
 * abilities (shuffled, plains before each — generateLevel's texture),
 * then the level's goals (pickup floors, then branch tips in spec
 * order); the strip ends with the exit_main floor.
 */
export function proposeLevelForSpecs({
    id, plan, stepsBetween, hazardChance,
    shelfChance = SHELF_CHANCE_DEFAULT, jitter = 0, splitChance = 0,
    ceilingChance = 0, rng, G,
}) {
    const floors = [{ role: 'entrance', gap: null }];
    const plains = () => {
        const n = 1 + Math.floor(rng.next() * stepsBetween);
        for (let i = 0; i < n; i++) floors.push({ role: 'plain', gap: { kind: 'run' } });
        if (ceilingChance > 0 && G.CEIL_RISE && rng.next() < ceilingChance) {
            floors.push({ role: 'plain', gap: { kind: 'ceil' } });
        }
        if (splitChance > 0 && rng.next() < splitChance) {
            floors.push({ role: 'plain', gap: { kind: 'split' } });
        }
    };
    plan.levels.forEach((level, i) => {
        // at most one reward shelf per WINDOW, on its last added gate
        // (orderGates): the shelf carries the window's first pickup,
        // which then derives exactly the window's requirement set
        const { order, shelfGate } = orderGates(
            rng, level.added, level.pickups.length > 0, shelfChance);
        const shelfPickupId = shelfGate ? level.pickups[0] : null;
        for (const ability of order) {
            plains();
            floors.push({
                role: 'plain',
                gap: {
                    ...gateGapFor(ability),
                    ...(ability === shelfGate ? { shelf: { pickupId: shelfPickupId } } : {}),
                },
            });
        }
        if (level.pickups.length > 0 || level.tips.length > 0
                || i === plan.levels.length - 1) plains();
        for (const pickupId of level.pickups) {
            if (pickupId === shelfPickupId) continue; // rides the shelf
            floors.push({ role: 'pickup', gap: { kind: 'run' }, pickupId });
        }
        for (const tip of level.tips) {
            floors.push({ role: 'plain', gap: { kind: 'branch', portalId: tip.portalId } });
        }
    });
    floors.push({ role: 'exit', gap: { kind: 'run' } });

    return assembleStrip(id, floors, realizePlan(floors, { rng, G, hazardChance, jitter }));
}

/**
 * Generate one strip realising per-goal requirements (sphere growth's
 * requirement-targeted entry; generateLevel stays the single-global-
 * requirement zone-table entry). Exit specs carry a caller key (the
 * grid side); the returned portalByKey maps it to the realised portal
 * id. Verification is the SAME gatekeeper as generateLevel —
 * validateLevel + deriveGeneratedRules, then every goal's minimal sets
 * must equal exactly its own requirement. Generator form: yields
 * { type: 'attempt', attempt, attempts } per proposal so the panel's
 * stepped flow can show generate-and-test progress live.
 *
 * @returns {{ level, derived, portalByKey }}
 */
export function* generateLevelForSpecsGen({
    id = 'gen',
    exitSpecs = [],
    pickupSpecs = [],
    stepsBetween = 2,
    hazardChance = 0.35,
    shelfChance = SHELF_CHANCE_DEFAULT,
    jitter = 0,
    splitChance = 0,
    ceilingChance = 0,
    ceilingMargin = 1,
    gapMargin = 0,
    seed = 1,
    attempts = 8,
    physics = DEFAULT_PROFILE_ID,
} = {}) {
    const { profileId, C, G } = resolveGenPhysics(physics);
    const Geff = applyCeilingMargin(applyGapMargin(G, gapMargin), ceilingMargin);
    // Structural validation runs ONCE (spec-level, non-retryable) so a
    // decline (non-nested chain, tipless maximal set) throws immediately.
    const plan = planStripSpecs(exitSpecs, pickupSpecs);
    if (!Geff.GLIDE_GAP && plan.levels.some((l) => l.added.includes('glide'))) {
        throw new Error(`generateLevelForSpecs('${id}'): the '${profileId}' physics`
            + ' profile refuses glide gates (no verifiable chasm window)');
    }

    const wantByGoal = new Map([
        ...exitSpecs.map((s) => [plan.portalByKey[s.key], [...new Set(s.requirement ?? [])].sort()]),
        ...pickupSpecs.map((s) => [s.id, [...new Set(s.requirement ?? [])].sort()]),
    ]);
    const rejected = [];
    for (let attempt = 0; attempt < attempts; attempt++) {
        yield { type: 'attempt', attempt: attempt + 1, attempts };
        const rng = createRng((seed * 8191 + attempt * 127) | 0);
        const level = proposeLevelForSpecs({
            id, plan, stepsBetween, hazardChance, shelfChance, jitter, splitChance,
            ceilingChance, rng, G: Geff,
        });
        const modelErrors = validateLevel(level, C);
        if (modelErrors.length > 0) {
            rejected.push(`attempt ${attempt}: ${modelErrors[0]}`);
            continue;
        }
        const derived = deriveGeneratedRules(level, C);
        if (derived.defects.length > 0) {
            rejected.push(`attempt ${attempt}: ${derived.defects[0]}`);
            continue;
        }
        const goals = [
            ...level.pickups.map((pk) => [pk.id, derived.pickups[pk.id]]),
            ...level.portals.map((pt) => [pt.id, derived.exits[pt.id]]),
        ];
        const bad = goals.find(([goalId, g]) => !sameSets(g.minimalSets, wantByGoal.get(goalId)));
        if (!bad) return { level, derived, portalByKey: plan.portalByKey };
        rejected.push(`attempt ${attempt}: '${bad[0]}' derived `
            + `!= [${wantByGoal.get(bad[0]).join('+')}]`);
    }
    throw new Error(`generateLevelForSpecs('${id}'): no valid proposal in ${attempts} attempts: `
        + rejected.join('; '));
}

/** Sync wrapper of generateLevelForSpecsGen (drains the attempt events). */
export function generateLevelForSpecs(opts) {
    const gen = generateLevelForSpecsGen(opts);
    let r = gen.next();
    while (!r.done) r = gen.next();
    return r.value;
}

// ── Zone table ──────────────────────────────────────────────────────

/**
 * Generate a complete winnable zone table (ZONES shape: [{level,
 * items}]) for the substrate factory. `count` >= 3: zone 0 (requires
 * nothing, grants the first ability item) + the second feature zone +
 * the Victory zone; anything beyond is filler.
 */
export function generateZoneSet({ count = 5, seed = 1, physics = DEFAULT_PROFILE_ID } = {}) {
    const featureCount = Object.keys(ABILITY_ITEM_NAMES).length;
    if (count < featureCount + 1) {
        throw new Error(`generateZoneSet: count must be >= ${featureCount + 1}`
            + ' (one zone per ability item + the Victory zone)');
    }
    const rng = createRng(seed);
    const featureGrants = rng.shuffle(Object.keys(ABILITY_ITEM_NAMES));
    const fillerCount = count - featureCount - 1;

    // zone plans: starter, second feature (+fillers interleaved), victory
    const plans = [{ requirement: [], grants: [featureGrants[0]] }];
    const middle = featureGrants.slice(1).map((g) => ({ grants: [g] }));
    for (let i = 0; i < fillerCount; i++) {
        middle.splice(Math.floor(rng.next() * (middle.length + 1)), 0, { filler: true });
    }
    plans.push(...middle, { victory: true });

    const granted = [];
    const zones = [];
    plans.forEach((plan, i) => {
        const isStarter = i === 0;
        let requirement = [];
        if (!isStarter && !plan.filler) {
            // require 1-2 already-granted abilities
            const pick = (from) => from[Math.floor(rng.next() * from.length)];
            requirement = [pick(granted)];
            if (granted.length > 1 && rng.next() < 0.5) {
                const more = granted.filter((a) => !requirement.includes(a));
                if (more.length) requirement.push(pick(more));
            }
        }
        const grants = plan.victory ? [] : (plan.grants ?? []);
        // The spec is stamped on the zone so extractZoneRules
        // (zoneRules.js) can re-run generateLevel with a branchCount
        // matching the exit sides it is asked for — same seed, so the
        // no-branch regeneration reproduces `level` byte-identically.
        const spec = {
            requirement,
            pickupCount: plan.victory ? 1 : grants.length,
            seed: (seed * 31 + i) | 0,
            physics,
        };
        const level = generateLevel({ id: `gen_z${i}`, ...spec });
        const items = {};
        level.pickups.forEach((pk, idx) => {
            items[pk.id] = plan.victory
                ? VICTORY_ITEM_NAME
                : ABILITY_ITEM_NAMES[grants[idx]];
        });
        granted.push(...grants);
        zones.push({ level, items, spec });
    });
    return zones;
}
