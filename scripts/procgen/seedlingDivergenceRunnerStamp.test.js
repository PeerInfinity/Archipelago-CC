/**
 * RUNNER SPEED on the divergence merge (slice `seedling-js-runner-stamp`): the per-shard stamp (median page boot,
 * play ticks/s) and the SLOW-RUNNER flag against the run's median shard. Information only — never a MERGE-FAIL.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SLOW_RUNNER_FRACTION, bootsOfLog, mergeVerdict, playOfRow, playRate, runnerStamp, shardStamp,
} from './seedlingDivergenceMerge.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('bootsOfLog', () => {
    it("reads the shard's number and each page's boot seconds", () => {
        const log = 'SHARD 9/10: 85 legs\nCHANNEL: headless logic-only\n'
            + 'INFO: page 1 booted in 82 s; botStatus fields: a,b\nINFO: page 1: 2 page error(s), ~2 swaps\n'
            + 'INFO: page 2 booted in 79 s; botStatus fields: a,b\n';
        // MUTANT: a pattern that also takes `INFO: page 1: 2 page error(s)` (or misses the shard) reads other numbers
        expect(bootsOfLog(log)).toEqual({ shard: 9, boots: [82, 79] });
    });

    it('a log with no SHARD line has no shard (the merge then leaves its boots out)', () => {
        expect(bootsOfLog('INFO: page 1 booted in 12 s;')).toEqual({ shard: null, boots: [12] });
    });
});

describe('playOfRow', () => {
    it("is the leg's wall ms minus its solves and its latch waits", () => {
        const r = { rowsDrained: 480, ms: 30000, history: [{ solvedMs: 4000 }, { solvedMs: 1000 }], latchWaits: [{ waitedMs: 5000 }] };
        // MUTANT: dropping the latch wait (or a solve) leaves 25000 / 29000 ms of "play"
        expect(playOfRow(r)).toEqual({ drained: 480, playMs: 20000 });
    });

    it('a row from before §5.89 (no latchWaits) counts its latch wait as play', () => {
        expect(playOfRow({ rowsDrained: 100, ms: 9000, history: [{ solvedMs: 1000 }] })).toEqual({ drained: 100, playMs: 8000 });
    });

    it('is null for a row that drained nothing, or whose solve took the whole leg', () => {
        expect(playOfRow({ rowsDrained: 0, ms: 90000, history: [{ solvedMs: null }] })).toBeNull();
        expect(playOfRow({ end: 'harness-hang' })).toBeNull();
        expect(playOfRow({ rowsDrained: 5, ms: 1000, history: [{ solvedMs: 1000 }] })).toBeNull();
    });
});

describe('playRate', () => {
    it('is POOLED over the rows (Σ ticks / Σ play s), not the mean of per-leg rates', () => {
        const rows = [{ rowsDrained: 100, ms: 10000 }, { rowsDrained: 900, ms: 30000 }, { rowsDrained: 0, ms: 90000 }];
        // pooled: 1000 / 40 s = 25; MUTANT mean of rates: (10 + 30) / 2 = 20
        expect(playRate(rows)).toEqual({ ticksPerSec: 25, legs: 2 });
        expect(playRate([{ rowsDrained: 0, ms: 1 }])).toBeNull();
    });
});

describe('runnerStamp', () => {
    const st = (shard, bootS, ticksPerSec) => ({ shard, bootS, boots: 1, ticksPerSec, playLegs: 1 });

    it('flags a shard below the fraction on PLAY alone, and on BOOT alone', () => {
        const r = runnerStamp([st(1, 20, 24), st(2, 20, 24), st(3, 20, 11.9), st(4, 41, 24), st(5, 20, 24)]);
        // the medians: boot 20 s, play 24 ticks/s; shard 3 plays at 0.496, shard 4 boots at 20/41 = 0.488
        expect(r.medians).toEqual({ bootS: 20, ticksPerSec: 24 });
        expect([...r.slow]).toEqual([3, 4]);
        expect(r.lines.filter((l) => l.endsWith('SLOW-RUNNER'))).toHaveLength(2);
    });

    it("BOOT speed is the median's seconds over the shard's: a FAST-booting shard is never slow", () => {
        // MUTANT shard/median: shard 1 (5 s against a 20 s median) would read x0.25 and be flagged slow
        const r = runnerStamp([st(1, 5, 24), st(2, 20, 24), st(3, 20, 24)]);
        expect(r.slow.size).toBe(0);
        expect(r.lines).toContain('RUNNER: shard 1 boot 5.0 s (1 page(s)) x4.00, play 24.0 ticks/s (1 leg(s)) x1.00');
    });

    it('AT the fraction is not slow (strictly below)', () => {
        // MUTANT `<=`: shard 3 at exactly x0.5 would be flagged
        const r = runnerStamp([st(1, 20, 24), st(2, 20, 24), st(3, 20, 12)]);
        expect(r.slow.size).toBe(0);
        expect(SLOW_RUNNER_FRACTION).toBe(0.5);
    });

    it('takes the MEDIAN of an even count as the mean of the middle two', () => {
        // MUTANT upper-middle: the play median would be 30, shard 1 (14) x0.47 → flagged
        const r = runnerStamp([st(1, 20, 14), st(2, 20, 26), st(3, 20, 30), st(4, 20, 40)]);
        expect(r.medians.ticksPerSec).toBe(28);
        expect(r.slow.size).toBe(0);
    });

    it('a shard with no data is printed with `-` and never flagged; no data anywhere prints nothing', () => {
        const r = runnerStamp([st(1, 20, 24), st(2, 20, 24), st(3, null, null)]);
        expect(r.slow.size).toBe(0);
        expect(r.lines).toContain('RUNNER: shard 3 boot -, play -');
        expect(runnerStamp([st(1, null, null)]).lines).toEqual([]);
    });

    it('re-derives §5.102: run 38994029714 flags shard 9 ONLY, and a healthy run (39153418159) flags none', () => {
        // the stamps this module prints off those runs' artifacts (boot median s, play ticks/s), shards 1..10
        const r38994 = [[16, 21.3], [20, 19.8], [12, 23.4], [13, 22.0], [16, 20.6], [13, 22.0], [12, 22.3], [19, 21.6], [78, 7.7], [12, 23.3]];
        const v = runnerStamp(r38994.map(([b, p], i) => st(i + 1, b, p)));
        expect([...v.slow]).toEqual([9]);
        expect(v.lines).toContain('RUNNER: shard 9 boot 78.0 s (1 page(s)) x0.19, play 7.7 ticks/s (1 leg(s)) x0.35 SLOW-RUNNER');
        const healthy = [[19, 23.6], [20, 22.6], [13, 25.7], [20, 22.9], [12, 24.7], [13, 25.1], [20, 24.0], [20, 23.6], [20, 22.0], [19, 23.3]];
        expect(runnerStamp(healthy.map(([b, p], i) => st(i + 1, b, p))).slow.size).toBe(0);
    });
});

describe('mergeVerdict — the runner lines', () => {
    const plan = { legs: 4, shards: [{ shard: 1, ids: [1, 2] }, { shard: 2, ids: [3] }, { shard: 3, ids: [4] }] };
    const row = (id, end, rowsDrained, ms, extra = {}) => ({ id, end, level: 12, rowsDrained, ms, history: [], ...extra });
    const log = (i, s) => `SHARD ${i}/3: 1 legs\nINFO: page 1 booted in ${s} s; botStatus fields: x\n`;

    it('tags a timeout on a slow shard SLOW-RUNNER, an ordinary one plain, and never fails the merge for it', () => {
        const rows = [row(1, 'done', 480, 20000), row(2, 'timeout', 400, 90000, { level: 40 }), row(3, 'done', 480, 20000), row(4, 'timeout', 450, 90000)];
        const v = mergeVerdict({ rows, plan, shardLogs: [log(1, 13), log(2, 14), log(3, 80)] });
        expect(v.failed).toBe(false);
        expect(v.slowShards).toEqual([3]);
        expect(v.lines).toContain('TIMEOUT: 2 L40 shard 1');
        expect(v.lines).toContain('TIMEOUT: 4 L12 shard 3 SLOW-RUNNER');
        expect(v.lines.filter((l) => l.startsWith('RUNNER: '))).toHaveLength(3);
    });

    it("maps a row to its shard through the PLAN's ids (rows carry no shard)", () => {
        // MUTANT: a row's own (absent) `shard` field → every timeout reads `shard ?`
        const rows = [row(1, 'timeout', 1, 90000), row(2, 'done', 1, 1000), row(3, 'done', 1, 1000), row(4, 'done', 1, 1000)];
        expect(mergeVerdict({ rows, plan }).lines.filter((l) => l.startsWith('TIMEOUT:'))).toEqual(['TIMEOUT: 1 L12 shard 1 SLOW-RUNNER']);
    });

    it('rows with no play and no logs print no runner lines (the earlier verdicts read as before)', () => {
        const v = mergeVerdict({ rows: [1, 2, 3, 4].map((id) => ({ id, end: 'done' })), plan });
        expect(v.lines.some((l) => l.startsWith('RUNNER'))).toBe(false);
    });

    it('shardStamp keeps a red shard (no rows, no boots) as `-`', () => {
        expect(shardStamp({ shard: 7 })).toEqual({ shard: 7, bootS: null, boots: 0, ticksPerSec: null, playLegs: 0 });
    });
});

describe('the workflow', () => {
    const wf = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');

    it("each shard's summary prints its own stamp, and the merge passes every shard log to the verdict", () => {
        expect(wf).toContain('node scripts/procgen/seedlingDivergenceMerge.js --shard-stamp "$D/rows-$I.jsonl" "$D/shard.log"');
        expect(wf).toContain('node scripts/procgen/seedlingDivergenceMerge.js merged/rows.jsonl plan/plan.json $LOGS');
    });
});
