/**
 * ⛓ REQUEST CAPTURE — the divergence sweep's `--capture-requests` writes each solve request as the worker received it
 * (`captureRequest`), and `replay-seedling-solve-request.mjs` restores it (`restoreRequest`). The round trip must give
 * back the structured clone the worker got — a Set lost to `{}` would replay a DIFFERENT request — and the switch
 * must stay off the rows (default OFF: today's sweep is unchanged).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { captureRequest, restoreRequest } from './seedlingSolveRequestCodec.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROBE = readFileSync(join(HERE, 'probe-seedling-divergence-sweep.mjs'), 'utf8');
const LAB = readFileSync(join(HERE, 'seedlingDivergenceLab.js'), 'utf8');
const WF = readFileSync(join(HERE, '..', '..', '.github', 'workflows', 'seedling-divergence-sweep.yml'), 'utf8');

const request = () => ({
    staging: { level: 40, x: 480, y: 896, persistence: new Map([[40, new Set([1, 4])]]), rng: { split: true }, t: Infinity },
    perTick: [new Set(['right']), new Set(), new Set(['right', 'x'])],
    equips: new Map([[3, 1]]),
    holes: [1, undefined, 3],
    budgetWork: 640,
    passes: [{ pass: 'dashless', dashMode: 'none', stop: 'all' }],
    levelSource: () => { throw new Error('a function never travels to the worker'); },
    source: { records: new Map([[40, { level: 40, tiles: [[0, 1]] }]]) },
});

describe('captureRequest / restoreRequest', () => {
    it('round-trips Map, Set, non-finite numbers and array holes to the worker\'s structured clone', () => {
        const { levelSource, ...worker } = request();
        const back = restoreRequest(JSON.parse(JSON.stringify(captureRequest(request()))));
        expect(back).toEqual(worker);
        expect(back.perTick[2]).toBeInstanceOf(Set);
        expect(back.staging.persistence.get(40)).toBeInstanceOf(Set);
        expect(back.source.records).toBeInstanceOf(Map);
        expect(back.staging.t).toBe(Infinity);
    });

    it('drops levelSource exactly as the worker service does (the worker rebuilds it from source.records)', () => {
        expect('levelSource' in captureRequest(request())).toBe(false);
    });

    it('MUTANT: without the tags a Set comes back as {} — the replay would solve a different request', () => {
        const naive = JSON.parse(JSON.stringify(request()));
        expect(naive.perTick[0]).toEqual({});
        expect(restoreRequest(captureRequest(request())).perTick[0]).toEqual(new Set(['right']));
    });
});

describe('--capture-requests is default OFF and never touches a row', () => {
    it('the probe reads it as empty by default and only then asks the lab for requests', () => {
        expect(PROBE).toMatch(/const CAPTURE = arg\('capture-requests', ''\);/);
        expect(PROBE).toMatch(/\.\.\.\(CAPTURE \? \{ captureRequests: true \} : \{\}\)/);
    });
    it('the requests are taken OFF the row before it is assigned (rows identical on or off)', () => {
        expect(PROBE).toMatch(/const \{ requests, \.\.\.served \} = r;/);
        expect(PROBE).toMatch(/Object\.assign\(row, served\);/);
        expect(PROBE).not.toMatch(/Object\.assign\(row, r\);/);
    });
    it('the lab serializes nothing unless asked', () => {
        expect(LAB).toMatch(/captureRequests = false/);
        expect(LAB).toMatch(/\.\.\.\(captureRequests \? \{ requests:/);
    });
    it('the workflow input defaults false and passes the flag only when on', () => {
        expect(WF).toMatch(/capture_requests:[\s\S]*?type: boolean\n\s+default: false/);
        expect(WF).toMatch(/\$\{CAPTURE:\+--capture-requests=\$D\/requests-\$I\.jsonl\}/);
    });
});

describe('⛓ SEAM TIME — the arrival game clock is on every row, in the merge, and sweepable in the replay', async () => {
    const { parseSeamSweep, atSeamTime } = await import('./replay-seedling-solve-request.mjs');
    const { mergeVerdict } = await import('./seedlingDivergenceMerge.js');
    it('the lab puts the first request\'s staging.seam.time on the row, unconditionally', () => {
        expect(LAB).toMatch(/\n {12}seamTime: solves\[0\]\?\.req\?\.staging\?\.seam\?\.time \?\? null,\n/);
    });
    it('the merge prints id@time:end for every row that carries it', () => {
        const plan = { legs: 2, shards: [{ shard: 1, ids: [397, 414] }] };
        const v = mergeVerdict({ plan, rows: [{ id: 397, end: 'failed', seamTime: 5140 }, { id: 414, end: 'timeout', seamTime: null }] });
        expect(v.lines).toContain('SEAM-TIME: 397@5140:failed 414@-:timeout');
        expect(mergeVerdict({ plan, rows: [{ id: 397, end: 'failed' }, { id: 414, end: 'failed' }] }).lines.some((l) => l.startsWith('SEAM-TIME'))).toBe(false);
    });
    it('--seam-time-sweep parses an inclusive integer range and refuses anything else by name', () => {
        expect(parseSeamSweep('')).toBe(null);
        expect(parseSeamSweep('-2..1')).toEqual([-2, -1, 0, 1]);
        for (const bad of ['3..1', '1', 'a..b', '-1..']) expect(() => parseSeamSweep(bad)).toThrow(/^--seam-time-sweep: /);
    });
    it('atSeamTime moves ONLY staging.seam.time (and never the captured request)', () => {
        const c = { staging: { seam: { time: 5140, level: 40 }, x: 1 }, budgetWork: 640 };
        const m = atSeamTime(c, 5135);
        expect(m).toEqual({ staging: { seam: { time: 5135, level: 40 }, x: 1 }, budgetWork: 640 });
        expect(c.staging.seam.time).toBe(5140);
    });
});
