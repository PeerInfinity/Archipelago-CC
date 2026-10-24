/**
 * seedlingDemo/axePricedCrossing — slice `seedling-fidelity-axeforcedu` (wave 19, planner `seedling-fidelity-planning-9`).
 *
 * ⚖ THE USER, 2026-10-11 ("Allow forced hits"): where every crossing takes a hit, the solver may plan the least-damage
 * crossing and bill the hit. ⚖ 2026-10-12 ("Model the game, do not plan around it"): the game BILLS a spinning axe's
 * blade (`SpinningAxe.hitPlayer`, force 5, damage 1; `Player.as:336` 20 i-frames), and the run models it
 * (`CONTACT_FIDELITY.spinningAxePlayerHit`).
 *
 * ── WHY THE FORCED-HIT RUNG CANNOT ASK THIS ONE ──────────────────────────────────────────────────────────────────
 * Its proof (`forcedHit.proveForcedHit`) is an exhaustive input tree from the state the ladder was asked in, and the
 * blade is met 47–153 ticks later: depth 3 already needs 46,656 more fork steps than the budget's 668 (AXETIMING's
 * hand-over; re-measured at `4667f7e353` on legs 603/636/774). A tree that deep can never prove it.
 *
 * ── (a) THE CERTIFICATE — a narrower claim, proven exactly ───────────────────────────────────────────────────────
 * The blade is a function of the visit's update count alone (the AXE report's D1), so the corridor the walk planned,
 * held at its DOORSTEP (the last sample no hit axe can reach at any angle) for `s` ticks, meets every axe at a phase
 * shifted by `s`; a stall of `s + period` meets it exactly as `s` does. So the stalls `0 … period − 1` ARE every
 * phase this corridor can be entered at, and each is priced with the run's own predicate (`hazards.axeHitsPlayer` on
 * each sample's PRE-move box at the visit's update count — the question `levelRun.stepSpinningAxesNow` bills). When
 * the pass may dash with a sword in `primary`, the same is asked at each phase of the sword's dash chain (AXETIMING's
 * family: `DASH_CHAIN_PATTERN` every `ORDINARY_SWING_PERIOD`, `AXE_TIMING_RUNG.offsetStep` apart). The certificate
 * HOLDS when no member of that family is a hitless crossing. Up to its first hit a walk's preview IS its run (the
 * run's own stepper), so "every member is hit in its preview" is "every member is hit on the run".
 * ⚠ What it does NOT cover, named: another corridor (the AXE arm's bent ones are bounded, not exhaustive); a stall
 * inside the reach or a slower walk than the walk's own policy (the relative-turn measure says how far a corridor is
 * from a gap — `turn` on the row — but it is not part of the proof).
 *
 * ── (b) THE CROSSING — priced by the run, not by the certificate ─────────────────────────────────────────────────
 * The family's members, fewest blade-contact samples first, are driven on forks of the segment (`solveSegment`'s
 * `fork`) exactly as the live drive will drive them: the doorstep stall, then the corridor by `botDriverV2.drive`.
 * The run bills each hit with its knockback, its i-frames and its shake (`levelRun.applyPlayerHit`), and the drive
 * re-steers through them. A member is admitted only when it reaches the walk's goal (the crossing's transition) alive,
 * every hit it bills is a spinning axe's, and the hits fit `FORCED_HITS`' budget — the forced-hit rung's own scale
 * (`maxHitsPerCrossing`, `maxPerSegment`, `margin`), not a new one. The fewest-billed admitted member is replayed on
 * the live run key for key; its rows must be the fork's.
 *
 * ── (c) THE VERDICT ──────────────────────────────────────────────────────────────────────────────────────────────
 * A trace row `strategy: {verb: 'forced-hit', rung: 'forced-hit', proof: {kind: 'axe-phase', …}, candidate, billed,
 * ticks}` and a `forcedHits` row on the segment's result — the forced-hit rung's own verdict, with this certificate in
 * place of the tree proof. OFF (`CONTACT_FIDELITY.axePricedCrossing`, the shipped state): never asked, byte-identical.
 */
import { CONTACT_FIDELITY } from './solverView.js';

/** The switch and its bounds. `SEEDLING_AXE_PRICED_CROSSING=0|1` for a node measurement, `withAxePricedCrossing` for a test. */
export const AXE_PRICED_CROSSING = {
    get enabled() { return CONTACT_FIDELITY.axePricedCrossing === true; },
    /** previews the certificate may spend (one family: the stalls `0 … rest` and one rest screen per chain phase) */
    maxPreviews: 200,
    /** members driven on a fork for their price, fewest blade-contact samples first */
    forkCandidates: 8,
};

/**
 * A read-only instrument: with `sink` set, the rung hands it one row per asking — `{what, at, cert, outcome:
 * 'billed' | 'not-certified' | 'no-crossing', candidate?, billed?, rejected?, why?}`. Inert while `null`.
 */
export const AXE_PRICED_TRACE = { sink: null };

/** Run `fn` with `CONTACT_FIDELITY.axePricedCrossing` set to `enabled`, restoring it (also on a throw). */
export function withAxePricedCrossing(enabled, fn) {
    const before = CONTACT_FIDELITY.axePricedCrossing;
    CONTACT_FIDELITY.axePricedCrossing = enabled === true;
    try {
        return fn();
    } finally {
        CONTACT_FIDELITY.axePricedCrossing = before;
    }
}

/** Is this `playerHits` row a spinning axe's (`levelRun.stepSpinningAxesNow`: `source: 'spinningaxe'`)? */
export const isAxeHit = (h) => h.source === 'spinningaxe';

/**
 * THE ADMISSION of one member driven on a fork: `{ok: true}` or `{ok: false, why}`. `crossed` is false when a walk
 * that crosses (`crossTo`) did not reach its level. The cap is `FORCED_HITS`' (passed in): per crossing, what is left
 * of the segment's, and `hits ≤ hitsMax − 1 − margin` after it.
 */
export function admitAxeCrossing({ billed, died, crossed, hitsMax, hitsNow, budgetLeft, maxHitsPerCrossing, margin }) {
    if (died > 0) return { ok: false, why: 'the crossing dies on the fork' };
    if (!crossed) return { ok: false, why: 'the crossing does not reach the walk\'s level on the fork' };
    const other = billed.filter((h) => !isAxeHit(h));
    if (other.length > 0) {
        return { ok: false, why: `the fork bills ${other.length} hit(s) that are not a spinning axe's `
            + `(${other.map((h) => `t${h.t} ${h.source}:${h.id}`).join(', ')}) — the certificate prices the axes only` };
    }
    const cap = Math.min(maxHitsPerCrossing, budgetLeft, hitsMax - 1 - margin - hitsNow);
    if (billed.length > cap) {
        return { ok: false, why: `the crossing takes ${billed.length} axe hit(s), over the budget's ${cap} (hits now `
            + `${hitsNow}, hitsMax ${hitsMax}, margin ${margin}, ${budgetLeft} left this segment, `
            + `${maxHitsPerCrossing} per crossing)` };
    }
    return { ok: true };
}
