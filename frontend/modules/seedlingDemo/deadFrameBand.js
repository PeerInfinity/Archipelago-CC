/**
 * seedlingDemo/deadFrameBand — how many dead frames a run's ROOM LOADS
 * are allowed to cost, as a function of how many loads there were.
 *
 * R5 slice 12 step 0. The band the differential sweep's dead-frame budget
 * compares its RESIDUE against:
 *
 *     residue = game.dead_frames − (the freezes the model knows about)
 *
 * Everything left over is room-load fade, and the question this module
 * answers is "how much of it is too much, and how little is too little".
 *
 * ── ⛔ WHY THE OLD SHAPE HAD TO GO, ON BOTH SIDES AT ONCE ─────────────
 *
 * Slice 10 shipped `[loads * 17, loads * 24]` — a LINEAR band whose ends
 * were the smallest and largest per-load fade anyone had seen. §24.85
 * measured what is wrong with that from two directions:
 *
 *   · THE FLOOR HAD ZERO MARGIN. The smallest observation WAS the floor,
 *     so `transition-west-return` reporting 50 against a floor of 51 went
 *     red — and four solo re-runs gave 56 every time. `blackCover` decays
 *     per RENDER while the gate samples per UPDATE, so a page that does
 *     not get scheduled loses fade frames: the `STARVED` class, not
 *     `STUCK`.
 *   · AND THE OBVIOUS FIX MAKES IT WORSE, because a linear band's WIDTH
 *     grows with the load count. Loosening the per-load floor to admit
 *     50/3 = 16.67 costs `r3-walk-full` (53 loads) 124 frames of floor,
 *     and a spurious 150-frame ceremony there lands only 150 below its
 *     residue. The detection this check exists for is destroyed by the
 *     fix for its flake.
 *
 * ⛓⛓ THE SHAPE THAT DOES BOTH IS `mean * N ± c * √N`. A tape's residue is
 * a SUM of N per-load fades; the sum's CENTRE grows linearly in N and its
 * SPREAD does not. So the floor gains absolute margin at every N while
 * the band as a whole gets TIGHTER than the linear one everywhere the
 * linear one was loose — at 53 loads the old ceiling was 1272 against a
 * recorded 1007, wide enough to admit a 150-frame freeze the model had
 * MISSED. The new one is [983, 1063] and catches it.
 *
 * ── ⛔ AND §24.85's NUMBERS DO NOT REPRODUCE ──────────────────────────
 *
 * §24.85 recorded "181 pure-fade observations, 17.33–21.00, mean 19.31,
 * σ 0.85" as prose, computed by hand, from a sweep whose payloads are in
 * a gitignored directory. Re-derived from the green sweep's own banked
 * payloads (`probe-seedling-deadframe-band`, all 79 tapes / 557 loads —
 * the FULL roster rather than a pure-fade subset) the numbers are
 * `FADE_STATS` below: 18.00–21.00, mean 19.13, σ 0.41. The 17.33 is
 * `52 / 3`, i.e. the flaking run itself; the loudest measured noise had
 * been folded into the estimate of the quantity it is noise ON.
 *
 * ⇒ the observations are BANKED as a committed file now
 * (`fixtures/dead-frame-observations.json`), because the only copy of the
 * numbers behind a shipped constant should not be a temp directory.
 */

import { CEREMONY_DEAD_FRAMES } from './sealCeremony.js';

/**
 * The per-load fade, re-derived from the differential sweep that gated
 * `247d859bb` (79/79 tapes, 1,162 checks). ⚠ LOAD-WEIGHTED: the quantity
 * is "what one load costs", so a 79-load tape is 79 observations of it
 * and a 1-load tape is one. An unweighted mean of per-tape means lets the
 * roster's many short tapes outvote the few long ones that measure the
 * constant precisely.
 *
 * ⛓ The spread is almost entirely PER-LEVEL, not per-run: every 1-load
 * tape reports an integer (18, 20 or 21) and reports the SAME integer
 * every time — [[feedback_dead_frame_constant_is_per_level]], measured
 * again here across the whole roster. Which is why `sigma` is small and
 * why `c` below is NOT derived from it.
 */
export const FADE_STATS = Object.freeze({
    tapes: 79,
    loads: 557,
    min: 18.0,
    max: 21.0,
    mean: 19.1275,
    sigma: 0.4117,
    source: 'verify-seedling-bot-differential --win, the sweep that gated 247d859bb; '
        + 're-derived by probe-seedling-deadframe-band',
});

/**
 * ⛓⛓ THE HALF-WIDTH AT ONE LOAD, IN FRAMES — and it is set from the
 * LOUDEST RUN-TO-RUN DISAGREEMENT EVER MEASURED, not from `sigma`.
 *
 * `sigma` describes how much levels differ from each other, and that is
 * not the failure the band has to tolerate. The failure is a STARVED
 * render loop, and the one time it was caught in the act
 * (`transition-west-return`, 3 loads: 50 once, 56 on four solo re-runs)
 * it cost 6 frames — 7.38 below `mean * 3`. Admitting it needs
 *
 *     c ≥ 7.38 / √3 = 4.26
 *
 * so `c = 4.5` is that, plus margin. ⚠ In `sigma` units it is 10.9σ,
 * which is exactly the point: a band sized by the per-LEVEL spread would
 * be far too tight for the per-RUN noise, and the two are different
 * quantities that happen to be measured in the same frames.
 *
 * ⚠ SYMMETRIC, though the noise is not. A starved run can only LOSE fade
 * frames, so the flake pushes residue DOWN and never up. The ceiling is
 * widened by the same amount anyway because it costs nothing: see
 * `MAX_HALF_WIDTH` — detection keeps a 1.9x margin at the roster's
 * largest tape either way, and a one-sided band invites the next reader
 * to ask which side is which.
 */
export const SPREAD_PER_SQRT_LOAD = 4.5;

/**
 * ⛔⛔ AND THE BAND IS CAPPED, SO DETECTION IS UNCONDITIONAL.
 *
 * The smallest freeze the model can be wrong about is one ordinary
 * `special` pickup ceremony — `CEREMONY_DEAD_FRAMES.pickup` = 150. A
 * band whose half-width reached 150 could admit a residue that missed
 * one entirely, so the half-width is capped at HALF of it: the budget
 * then rejects any single-ceremony error at every load count, forever,
 * rather than "at the load counts the roster happens to have".
 *
 * ⚠ It is not active today — `4.5 * √79 = 40.0` against a cap of 75, so
 * the roster would have to reach 278 loads in one tape before the cap
 * bites. It is here so that growth cannot silently disarm the check,
 * which is the shape of [[feedback_coincidental_predicate_rots]].
 */
export const MAX_HALF_WIDTH = CEREMONY_DEAD_FRAMES.pickup / 2;

/**
 * The band a run's fade residue must land in.
 *
 * @param {number} loads — world builds, i.e. `transitions.length + 1`.
 * @returns {{lo:number, hi:number, centre:number, half:number, capped:boolean}}
 */
export function fadeBand(loads) {
    if (!Number.isInteger(loads) || loads < 1) {
        throw new RangeError(`fadeBand: loads must be a positive integer, got ${loads}`);
    }
    const centre = FADE_STATS.mean * loads;
    const raw = SPREAD_PER_SQRT_LOAD * Math.sqrt(loads);
    const half = Math.min(raw, MAX_HALF_WIDTH);
    return { lo: centre - half, hi: centre + half, centre, half, capped: raw > MAX_HALF_WIDTH };
}

/** Slice 10's linear band, kept so the comparison in the probe is real. */
export const LEGACY_FADE_PER_LOAD = Object.freeze({ min: 17, max: 24 });

/** @param {number} loads */
export function legacyFadeBand(loads) {
    return { lo: loads * LEGACY_FADE_PER_LOAD.min, hi: loads * LEGACY_FADE_PER_LOAD.max };
}

/** One line for a check's detail string. */
export function describeFadeBand(loads) {
    const b = fadeBand(loads);
    return `${loads} load(s) at ${FADE_STATS.mean}/load ± ${b.half.toFixed(1)}`
        + `${b.capped ? ' (CAPPED)' : ` (${SPREAD_PER_SQRT_LOAD}·√${loads})`} `
        + `= [${b.lo.toFixed(1)},${b.hi.toFixed(1)}]`;
}
