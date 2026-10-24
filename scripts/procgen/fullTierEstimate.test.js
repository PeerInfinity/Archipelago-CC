/**
 * fullTierEstimate — the estimator's own rows (R9 slice P3b, §47.11 (3) (d)).
 *
 * ⛔⛔ WHAT THESE ROWS ARE FOR. R9 slice 12h quoted ~55 min for a run that took
 * ~89 (§47.8 item 5), because the estimate came from a tape COUNT and then
 * from a per-tape RATE measured on the short R1–R4 walks. Both of those are
 * shapes a test can REFUSE, and the discriminating one is below: two sets with
 * the SAME tape count and different tick sums must not price the same.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    CI_TIER_CALIBRATION, FIXED_SEC_PER_TAPE, FULL_TIER_CALIBRATION, FULL_TIER_WORKFLOW,
    FULL_TIER_WORKFLOW_DEFAULT_SHARDS, SEC_PER_KILOTICK, describeFullTierEstimate,
    describeTierCosts, estimateCiReplaySeconds, estimateCiShardedSeconds,
    estimateCiSingleSeconds, estimateFullTierSeconds, fitTapeCost, githubRepoOf,
    reDriveCommands, rosterLabels, tapeTicksOf, tickSumOf,
} from './fullTierEstimate.js';
import { partitionTapes } from './fullTierShards.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const TAPES = join(REPO, 'frontend/modules/seedlingDemo/fixtures/tapes');

describe('fullTierEstimate', () => {
    /**
     * ⛓⛓⛓ THE CALIBRATION IS A CLAIM ABOUT A MEASUREMENT, so it is checked
     * against that measurement rather than against itself. R9 slice 12h drove
     * the full tier in 143 minutes; the two constants have to reproduce it.
     */
    it('reproduces the 12h full-tier measurement it is calibrated on, within 5 %', () => {
        const { tapes, ticks, minutes } = FULL_TIER_CALIBRATION;
        const predicted = estimateFullTierSeconds({ tapes, ticks }) / 60;
        expect(Math.abs(predicted - minutes) / minutes).toBeLessThan(0.05);
    });

    /**
     * ⛔⛔ THE ROW THAT REFUSES §47.8 ITEM 5's SHAPE. A per-tape estimator
     * cannot tell these two apart; this one must.
     */
    it('prices two rosters of the SAME tape count differently when their ticks differ', () => {
        const short = estimateFullTierSeconds({ tapes: 10, ticks: 1000 });
        const long = estimateFullTierSeconds({ tapes: 10, ticks: 20000 });
        expect(long).toBeGreaterThan(short);
        /* ⛓ …and the whole difference is the tick term, to the second. */
        expect(long - short).toBeCloseTo((SEC_PER_KILOTICK * 19000) / 1000, 6);
    });

    it('charges the fixed per-load cost even for a zero-tick roster', () => {
        expect(estimateFullTierSeconds({ tapes: 3, ticks: 0 }))
            .toBeCloseTo(FIXED_SEC_PER_TAPE * 3, 6);
    });

    /**
     * ⛓ THE SENTENCE CARRIES ITS PROVENANCE. A consumer prints this line and
     * nothing else, so the head the calibration came from has to be in it —
     * otherwise an estimate reads exactly like a measurement.
     */
    it('describes itself with both constants and the head it was calibrated at', () => {
        const said = describeFullTierEstimate({ tapes: 2, ticks: 3000 });
        expect(said).toContain('≈');
        expect(said).toContain(`${FIXED_SEC_PER_TAPE} s × tapes`);
        expect(said).toContain(`${SEC_PER_KILOTICK} s × ticks/1000`);
        expect(said).toContain(FULL_TIER_CALIBRATION.measuredAt);
    });

    /**
     * ⛔ A MISSING TAPE IS A STOP. Contributing 0 would make a roster look
     * CHEAPER the more of it had gone missing — the wrong direction for every
     * decision this feeds.
     */
    it('refuses a label with no tape BY NAME rather than counting it as zero', () => {
        expect(() => tickSumOf(['no-such-tape-p3b'], { tapesDir: TAPES }))
            .toThrow(/no-such-tape-p3b/);
    });

    it('sums the committed roster and agrees with the roster it enumerates', () => {
        const roster = rosterLabels({ tapesDir: TAPES });
        expect(roster).not.toContain('index');
        expect(roster.length).toBeGreaterThan(100);
        expect(tickSumOf(roster, { tapesDir: TAPES })).toBeGreaterThan(0);
    });

    it('tapeTicksOf and tickSumOf agree on the committed roster', () => {
        const roster = rosterLabels({ tapesDir: TAPES });
        const per = tapeTicksOf(roster, { tapesDir: TAPES });
        expect(per.map((t) => t.name)).toEqual(roster);
        expect(per.reduce((n, t) => n + t.ticks, 0)).toBe(tickSumOf(roster, { tapesDir: TAPES }));
    });
});

describe('CI_TIER_CALIBRATION — the runner prices, each against its own run (F1)', () => {
    const { single, sharded } = CI_TIER_CALIBRATION;

    /**
     * ⛓⛓ THE FIT IS CHECKED AGAINST ITS RUN'S TOTALS, the way the box pair is
     * checked against 12h: replay secs from the fit, and the job wall = fit +
     * the job's own overhead.
     */
    it('reproduces run 34729518557 (one job): replay and job wall within 1 %', () => {
        const replay = estimateCiReplaySeconds(single);
        expect(Math.abs(replay - single.replaySec) / single.replaySec).toBeLessThan(0.01);
        const job = estimateCiSingleSeconds(single);
        expect(Math.abs(job - single.jobSec) / single.jobSec).toBeLessThan(0.01);
        expect(single.jobOverheadSec).toBe(single.jobSec - single.replaySec);
    });

    /**
     * ⛓⛓ NOT CIRCULAR: the components (before-shards, per-shard overhead, merge)
     * are job timestamps; the whole wall is the RUN's creation → update. The
     * slowest bin comes from partitioning TODAY's committed roster, so a roster
     * that drifted far from the calibration's reds this row too.
     */
    it('reproduces run 34734861224 (10 shards) from its components within 5 %', () => {
        const tapes = tapeTicksOf(rosterLabels({ tapesDir: TAPES }), { tapesDir: TAPES });
        const bins = partitionTapes(tapes, sharded.shards).shards;
        const wall = estimateCiShardedSeconds(bins);
        expect(Math.abs(wall - sharded.wallSec) / sharded.wallSec).toBeLessThan(0.05);
    });

    it('prices a shard plan by its SLOWEST shard, not by the sum', () => {
        const one = estimateCiShardedSeconds([{ tapes: 10, ticks: 10000 }]);
        const two = estimateCiShardedSeconds([{ tapes: 10, ticks: 10000 }, { tapes: 1, ticks: 10 }]);
        expect(two).toBeCloseTo(one, 6);
        expect(estimateCiShardedSeconds([{ tapes: ['a', 'b'], ticks: 500 }]))
            .toBeCloseTo(estimateCiShardedSeconds([{ tapes: 2, ticks: 500 }]), 6);
    });

    it('fitTapeCost recovers a known line', () => {
        const pts = [100, 900, 2500, 12000].map((ticks) => ({ ticks, secs: 3 + (40 * ticks) / 1000 }));
        const fit = fitTapeCost(pts);
        expect(fit.secPerTape).toBeCloseTo(3, 6);
        expect(fit.secPerKilotick).toBeCloseTo(40, 6);
    });

    it('describes box · CI single · CI sharded with both runs and SHAs', () => {
        const said = describeTierCosts({
            tapes: 2, ticks: 3000, bins: [{ tapes: 2, ticks: 3000 }], shards: 10,
        });
        expect(said).toMatch(/^box ≈ \d+ min · CI single ≈ \d+ min · CI sharded\(n=10\) ≈ \d+ min /);
        for (const s of [single.run, single.measuredAt, sharded.run, sharded.measuredAt,
            FULL_TIER_CALIBRATION.measuredAt]) expect(said).toContain(s);
    });
});

describe('reDriveCommands — the advice names things that exist (F1)', () => {
    const WF = join(REPO, '.github/workflows', FULL_TIER_WORKFLOW);

    /** ⛔ A renamed workflow or input reds here, not in a pasted command that 404s. */
    it('the CI dispatch names a workflow file on disk with `tier` and `shards` inputs', () => {
        expect(existsSync(WF)).toBe(true);
        const yml = readFileSync(WF, 'utf8');
        const cmd = reDriveCommands({ tier: 'campaign', repo: 'o/r' });
        expect(cmd.ci).toBe(`gh workflow run ${FULL_TIER_WORKFLOW} -f tier=campaign `
            + `-f shards=${FULL_TIER_WORKFLOW_DEFAULT_SHARDS} --repo o/r`);
        expect(yml).toMatch(/workflow_dispatch:\s*\n\s*inputs:\s*\n\s*tier:/);
        const shards = /\n(\s*)shards:\s*\n(?:\1\s+.*\n)*?\1\s+default:\s*(\d+)/.exec(yml);
        expect(shards?.[2]).toBe(String(FULL_TIER_WORKFLOW_DEFAULT_SHARDS));
    });

    it('the box drive has no --win and names the differential that exists', () => {
        const { box } = reDriveCommands({ tier: 'mechanic' });
        expect(box).not.toContain('--win');
        expect(existsSync(join(REPO, box.split(' ')[1]))).toBe(true);
        expect(box).toContain('--tier=mechanic');
    });

    it('githubRepoOf reads https and ssh remotes, and refuses others', () => {
        expect(githubRepoOf('https://github.com/PeerInfinity/Archipelago-CC.git')).toBe('PeerInfinity/Archipelago-CC');
        expect(githubRepoOf('git@github.com:o/r.git')).toBe('o/r');
        expect(githubRepoOf('https://example.com/o/r')).toBeNull();
    });
});

