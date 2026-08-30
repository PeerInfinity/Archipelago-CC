/**
 * fullTierEstimate — **WHAT A `--win --tier=full` ROSTER COSTS, FROM THE TICK
 * SUM AND NOTHING ELSE** (R9 slice P3b, §47.11 (3) (d)).
 *
 * ── ⛔⛔ WHY THIS IS NOT A TAPE COUNT ─────────────────────────────────
 *
 * R9 slice 12h quoted ~55 min for a run that took ~89 (§47.8 item 5): the
 * estimate came from a tape COUNT and then from a per-tape RATE measured on
 * the short R1–R4 walks, which is wrong twice. A tape is driven in REAL TIME,
 * so its price is its `tick_count`; the only per-tape constant is the fixed
 * cost of standing a load up.
 *
 *   seconds ≈ FIXED_SEC_PER_TAPE × tapes  +  SEC_PER_KILOTICK × ticks / 1000
 *
 * ⛓ THE CONSTANTS ARE A CALIBRATION, AND THEY CARRY THEIR MEASUREMENT. R9
 * slice 12h drove the FULL tier — 149 tapes, 128,966 ticks — in 143 minutes at
 * `04034c948`. Those two constants reproduce it as **142.4 min**. They are
 * published here with that measurement beside them so a reader can tell an
 * estimate from a number somebody liked.
 *
 * ⛔ AN ESTIMATE IS NEVER A SUBSTITUTE FOR THE MEASUREMENT. Every consumer of
 * this module prints the word "≈" and says what the estimate is FOR — deciding
 * whether to spend the box. A standing value is what a run PRODUCED.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** ⛓ The per-load fixed cost — page load, world swap, the fade. */
export const FIXED_SEC_PER_TAPE = 8;
/** ⛓ The real-time cost of a thousand ticks driven through the game. */
export const SEC_PER_KILOTICK = 57;

/**
 * ⛓ THE MEASUREMENT THE TWO CONSTANTS ARE CALIBRATED AGAINST — quoted, with
 * the head it was driven at, so the calibration can be re-checked rather than
 * believed. R9 slice 12h, §47.1 / the `roster: --win --tier=full` standing row.
 */
export const FULL_TIER_CALIBRATION = Object.freeze({
    tapes: 149,
    ticks: 128966,
    minutes: 143,
    measuredAt: '04034c948',
    why: 'R9 slice 12h drove the FULL tier at this head; §47.11 (3) (d)',
});

/** Seconds a `--win` drive of `tapes` tapes totalling `ticks` ticks costs. */
export function estimateFullTierSeconds({ tapes, ticks }) {
    return FIXED_SEC_PER_TAPE * tapes + (SEC_PER_KILOTICK * ticks) / 1000;
}

/** ⛓ The same estimate as the ONE sentence every consumer prints. */
export function describeFullTierEstimate({ tapes, ticks }) {
    const sec = estimateFullTierSeconds({ tapes, ticks });
    return `≈ ${(sec / 60).toFixed(0)} min for ${tapes} tape(s) / ${ticks.toLocaleString('en-US')} `
        + `tick(s) (${FIXED_SEC_PER_TAPE} s × tapes + ${SEC_PER_KILOTICK} s × ticks/1000; `
        + `calibrated on ${FULL_TIER_CALIBRATION.minutes} min over `
        + `${FULL_TIER_CALIBRATION.tapes} tape(s) / `
        + `${FULL_TIER_CALIBRATION.ticks.toLocaleString('en-US')} tick(s) at `
        + `${FULL_TIER_CALIBRATION.measuredAt})`;
}

/**
 * The tick sum of a set of tape labels, read off the tapes themselves.
 *
 * ⛔ A LABEL WITH NO TAPE IS A STOP, NOT A ZERO. A missing file silently
 * contributing 0 would make a complement look cheaper the more of it had gone
 * missing, which is the wrong direction for every decision this feeds.
 */
export function tickSumOf(labels, { tapesDir }) {
    let sum = 0;
    for (const label of labels) {
        const p = join(tapesDir, `${label}.json`);
        let raw;
        try { raw = JSON.parse(readFileSync(p, 'utf8')); } catch (e) {
            throw new Error(`fullTierEstimate: ${label} has no readable tape at ${p} — `
                + `${e.message}. A tick sum over a label with no tape would price a roster `
                + 'that does not exist.');
        }
        if (!Number.isInteger(raw.tick_count)) {
            throw new Error(`fullTierEstimate: ${label} carries no integer \`tick_count\``);
        }
        sum += raw.tick_count;
    }
    return sum;
}

/**
 * ⛓ EVERY TAPE ON DISK — the same rule the pipeline's `allTapeLabels` uses
 * (the directory, minus its index), spelled once so a caller that only wants
 * the roster does not re-derive it.
 */
export function rosterLabels({ tapesDir }) {
    return readdirSync(tapesDir)
        .filter((f) => f.endsWith('.json') && f !== 'index.json')
        .map((f) => f.slice(0, -5))
        .sort();
}
