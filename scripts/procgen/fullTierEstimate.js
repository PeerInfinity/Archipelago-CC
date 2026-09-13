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
 * believed. R9 slice 12h, §47.1 / the `roster: --tier=full` standing row (named
 * `roster: --win --tier=full` until H2).
 */
export const FULL_TIER_CALIBRATION = Object.freeze({
    tapes: 149,
    ticks: 128966,
    minutes: 143,
    measuredAt: '04034c948',
    why: 'R9 slice 12h drove the FULL tier at this head; §47.11 (3) (d)',
});

/**
 * ⛓⛓ F1 (2026-09-13) — **THE SAME ROSTER ON A RUNNER, WITH ITS TWO RUNS.** The
 * box model above over-prices a GitHub-hosted runner (logic-only, 4 vCPU): H2's
 * single-job dispatch drove the full tier in 5,794 replay seconds against the
 * box model's 8,591. The per-tape fit below is that run's own least squares
 * (`secs ≈ secPerTape + secPerKilotick × ticks/1000` over its 150 checkpoint
 * entries); the sharded components are H3's ten-shard run, read off its job
 * timestamps and shard checkpoints. Every field is a measurement of the run
 * named beside it.
 *
 * ⛓ RE-DERIVE (the artifacts are kept 90 days from the run):
 *   gh run download 34729518557 --repo PeerInfinity/Archipelago-CC -D single
 *   → least squares of each checkpoint entry's `secs` on its tape's `tick_count`
 *     at `measuredAt` (`fitTapeCost` below) — 3.688 / 40.417 over 150 tapes.
 *   gh api repos/PeerInfinity/Archipelago-CC/actions/runs/34734861224/jobs
 *   → run created 03:11:17Z → updated 03:23:18Z = 721 s; first shard started
 *     03:11:34Z (17 s after creation: plan job + queue); last shard ended
 *     03:22:11Z, merge ended 03:23:17Z (66 s); per shard, job wall minus its
 *     checkpoint's replay secs = 30–44 s, median 36.5 s.
 */
export const CI_TIER_CALIBRATION = Object.freeze({
    single: Object.freeze({
        secPerTape: 3.69,
        secPerKilotick: 40.4,
        /** job wall − replay secs: checkout/node/npm/Chromium + boot + roster-wide checks. */
        jobOverheadSec: 80,
        tapes: 150,
        ticks: 129667,
        replaySec: 5794,
        jobSec: 5874,
        run: '34729518557',
        measuredAt: 'bcea3b5fb5',
        why: 'H2 ruling C: seedling-full-tier.yml dispatched as ONE job, tier=full, ubuntu-latest',
    }),
    sharded: Object.freeze({
        shards: 10,
        /** run creation → first shard job start (the plan job and the matrix queue). */
        beforeShardsSec: 17,
        /** per shard job: wall − its own replay secs (median of ten; range 30–44). */
        shardOverheadSec: 36.5,
        /** last shard end → merge end (the merge replays nothing: reuse 150/150). */
        mergeSec: 66,
        tapes: 150,
        ticks: 129667,
        wallSec: 721,
        run: '34734861224',
        measuredAt: '2715a0c86c',
        why: 'H3: seedling-full-tier.yml plan → 10 shard jobs → merge, tier=full',
    }),
});

/** ⛓ The workflow a CI drive is dispatched through, and its `shards` input's default. */
export const FULL_TIER_WORKFLOW = 'seedling-full-tier.yml';
export const FULL_TIER_WORKFLOW_DEFAULT_SHARDS = 10;

/**
 * ⛓ THE TWO WAYS TO RE-DRIVE A TIER, as the commands a reader pastes: the CI
 * dispatch (plan → shards → merge, headless logic-only) and the box drive —
 * no `--win`: the differential is headless by default since H1, and `--win` is
 * only for real-GPU pixel rows. `repo` = `owner/name`, from the caller's origin.
 */
export function reDriveCommands({ tier, repo, shards = FULL_TIER_WORKFLOW_DEFAULT_SHARDS }) {
    return {
        ci: `gh workflow run ${FULL_TIER_WORKFLOW} -f tier=${tier} -f shards=${shards}`
            + `${repo ? ` --repo ${repo}` : ''}`,
        box: `node scripts/procgen/check-seedling-bot-differential.mjs --tier=${tier}`,
    };
}

/** `owner/name` from a GitHub remote URL (https or ssh), or null. */
export function githubRepoOf(url) {
    const m = /github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(String(url ?? '').trim());
    return m ? `${m[1]}/${m[2]}` : null;
}

/** Replay seconds of `tapes` tapes / `ticks` ticks on a runner (the H2 fit, no overheads). */
export function estimateCiReplaySeconds({ tapes, ticks }) {
    const c = CI_TIER_CALIBRATION.single;
    return c.secPerTape * tapes + (c.secPerKilotick * ticks) / 1000;
}

/** Wall seconds of ONE runner job driving the roster (H2's shape). */
export function estimateCiSingleSeconds({ tapes, ticks }) {
    return CI_TIER_CALIBRATION.single.jobOverheadSec + estimateCiReplaySeconds({ tapes, ticks });
}

/**
 * Wall seconds of the sharded workflow: the slowest shard job decides it.
 * `bins` = the partition's shards as `{ tapes: <count | names[]>, ticks }` —
 * `fullTierShards.partitionTapes(…).shards` passes as-is.
 */
export function estimateCiShardedSeconds(bins) {
    const c = CI_TIER_CALIBRATION.sharded;
    const slowest = Math.max(0, ...bins.map((b) => estimateCiReplaySeconds({
        tapes: Array.isArray(b.tapes) ? b.tapes.length : b.tapes, ticks: b.ticks,
    })));
    return c.beforeShardsSec + c.shardOverheadSec + slowest + c.mergeSec;
}

/**
 * Least squares of per-tape runner seconds on kiloticks — how `single`'s two
 * constants are re-derived from a run's checkpoint. `points` = `[{ secs, ticks }]`.
 */
export function fitTapeCost(points) {
    const n = points.length;
    const xs = points.map((p) => p.ticks / 1000);
    const sx = xs.reduce((a, x) => a + x, 0);
    const sy = points.reduce((a, p) => a + p.secs, 0);
    const sxx = xs.reduce((a, x) => a + x * x, 0);
    const sxy = points.reduce((a, p, i) => a + xs[i] * p.secs, 0);
    const secPerKilotick = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return { secPerTape: (sy - secPerKilotick * sx) / n, secPerKilotick };
}

const minutes = (sec) => `${(sec / 60).toFixed(0)} min`;

/**
 * ⛓ THE THREE PRICES ON ONE LINE — box, one runner job, the sharded workflow —
 * each with the run it is calibrated on, so the decision where to drive a tier
 * reads its costs side by side.
 */
export function describeTierCosts({ tapes, ticks, bins, shards }) {
    const s = CI_TIER_CALIBRATION.single;
    const h = CI_TIER_CALIBRATION.sharded;
    return `box ≈ ${minutes(estimateFullTierSeconds({ tapes, ticks }))} · `
        + `CI single ≈ ${minutes(estimateCiSingleSeconds({ tapes, ticks }))} · `
        + `CI sharded(n=${shards}) ≈ ${minutes(estimateCiShardedSeconds(bins))} `
        + `for ${tapes} tape(s) / ${ticks.toLocaleString('en-US')} tick(s) `
        + `(box ${FIXED_SEC_PER_TAPE} s × tapes + ${SEC_PER_KILOTICK} s × ticks/1000 @${FULL_TIER_CALIBRATION.measuredAt}; `
        + `runner ${s.secPerTape} s × tapes + ${s.secPerKilotick} s × ticks/1000, run ${s.run} @${s.measuredAt}; `
        + `sharded = slowest shard + ${h.beforeShardsSec + h.shardOverheadSec + h.mergeSec} s, run ${h.run} @${h.measuredAt})`;
}

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
    return tapeTicksOf(labels, { tapesDir }).reduce((sum, t) => sum + t.ticks, 0);
}

/** `[{ name, ticks }]` per label, the shape `fullTierShards.partitionTapes` takes. */
export function tapeTicksOf(labels, { tapesDir }) {
    return labels.map((label) => {
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
        return { name: label, ticks: raw.tick_count };
    });
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
