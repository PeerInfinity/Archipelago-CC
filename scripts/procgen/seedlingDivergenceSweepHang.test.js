/**
 * H1 — THE SWEEP HANG BOUND (sweep-4 shard 9, CI run 38110831520, sat ~5 h after its 18th page and named nothing):
 * every harness step between legs runs under a measured wall-clock bound, a hang is named and costs only its page's
 * legs (`end: 'harness-hang'`), and the merge names both those and every id a shard never reported.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { HANG_BOUNDS_MS, SweepHang, bounded, hangRow, parseInjectHang } from './probe-seedling-divergence-sweep.mjs';
import { mergeVerdict } from './seedlingDivergenceMerge.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = readFileSync(join(HERE, 'probe-seedling-divergence-sweep.mjs'), 'utf8');
const never = () => new Promise(() => {});

describe('bounded', () => {
    it('passes a step that finishes inside its bound through', async () => {
        await expect(bounded('newPage', 200, async () => 7)).resolves.toBe(7);
    });

    it('a step that never resolves fails BY NAME at its bound', async () => {
        const t0 = Date.now();
        const e = await bounded('browserClose', 50, never).catch((x) => x);
        expect(e).toBeInstanceOf(SweepHang);
        expect(e.step).toBe('browserClose');
        expect(e.message).toBe('browserClose exceeded 0.05 s');
        expect(Date.now() - t0).toBeLessThan(1000);
    });

    it("a step's own error is its own (not a hang)", async () => {
        await expect(bounded('boot', 200, async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    });

    it('the MUTANT (enabled: false) has no bound: the hang outlives it', async () => {
        const r = await Promise.race([bounded('newPage', 20, never, { enabled: false }).then(() => 'resolved', () => 'hang-named'),
            new Promise((ok) => { setTimeout(() => ok('still waiting'), 150); })]);
        expect(r).toBe('still waiting');
    });
});

describe('parseInjectHang (TEST-ONLY, inert by default)', () => {
    it('is EMPTY when the env is unset or blank', () => {
        expect(parseInjectHang(undefined)).toEqual([]);
        expect(parseInjectHang('')).toEqual([]);
    });

    it('reads <page>:<step>[,…]', () => {
        expect(parseInjectHang('2:newPage, 3:leg')).toEqual([{ page: 2, step: 'newPage' }, { page: 3, step: 'leg' }]);
    });

    it('refuses an unknown step or a bad page by name', () => {
        expect(() => parseInjectHang('1:bogus')).toThrow(/SWEEP_INJECT_HANG: "1:bogus"/);
        expect(() => parseInjectHang('0:leg')).toThrow(/SWEEP_INJECT_HANG/);
        expect(() => parseInjectHang('leg')).toThrow(/SWEEP_INJECT_HANG/);
    });
});

describe('the bounds', () => {
    it('cover the six harness steps, each finite', () => {
        expect(Object.keys(HANG_BOUNDS_MS).sort()).toEqual(['boot', 'browserClose', 'launch', 'leg', 'newPage', 'pageClose']);
        for (const ms of Object.values(HANG_BOUNDS_MS)) expect(ms).toBeGreaterThan(0);
    });

    it("no recycle step of the probe is awaited OUTSIDE its bound (the four H1 named, ⛔ a bare await is the 5 h hang)", () => {
        for (const bare of [/await page\.close\(\)/, /await browser\.close\(\)/, /await chromium\.launch\(/, /await browser\.newPage\(/]) {
            expect(SRC).not.toMatch(bare);
        }
        for (const s of Object.keys(HANG_BOUNDS_MS)) expect(SRC).toContain(`step('${s}'`);
    });

    it('a leg is named before it starts', () => {
        expect(SRC).toMatch(/console\.log\(`LEG \$\{leg\.id\} start/);
    });
});

describe('hangRow', () => {
    it('carries the leg, the step and whether it had started', () => {
        const leg = { id: 5, key: 'k', level: 3, goal: { name: 'g', kind: 'exit' }, sphere: { label: '0.1' } };
        const r = hangRow(leg, { mode: 'inv', producer: 'solver', page: 2, pageLeg: 0, step: 'leg', ms: 1200000, started: true });
        expect(r).toMatchObject({ id: 5, key: 'k', page: 2, end: 'harness-hang', hang: { step: 'leg', boundS: 1200, started: true } });
        expect(r.error).toMatch(/after this leg started/);
    });
});

describe('mergeVerdict', () => {
    const plan = { legs: 5, shards: [{ shard: 1, ids: [1, 2, 3] }, { shard: 2, ids: [4, 5] }] };
    const row = (id, end = 'done', extra = {}) => ({ id, end, ...extra });

    it('a complete sweep passes', () => {
        const v = mergeVerdict({ rows: [1, 2, 3, 4, 5].map((i) => row(i)), plan });
        expect(v.failed).toBe(false);
        expect(v.redispatch).toEqual([]);
    });

    it('a harness-hang row fails BY NAME, with its step, and is re-dispatched', () => {
        const v = mergeVerdict({ rows: [row(1), row(2, 'harness-hang', { page: 2, hang: { step: 'newPage', started: false } }), row(3), row(4), row(5)], plan });
        expect(v.failed).toBe(true);
        expect(v.lines).toContain('MERGE-FAIL: 1 leg(s) on a page that HUNG in a harness step (harness-hang): 2 (page 2, newPage)');
        expect(v.redispatch).toEqual([2]);
    });

    it('a shard that never reported (cancelled / timed out) lists its ids, and the union is the REDISPATCH line', () => {
        const v = mergeVerdict({ rows: [row(1), row(4)], plan });
        expect(v.failed).toBe(true);
        expect(v.missing).toEqual({ 1: [2, 3], 2: [5] });
        expect(v.lines).toContain('MERGE-FAIL: shard 1 never reported 2 of its 3 leg(s): 2,3');
        expect(v.lines).toContain('REDISPATCH ids=2,3,5');
    });

    it('a teardown hang after every leg reported WARNS, never fails', () => {
        const v = mergeVerdict({ rows: [1, 2, 3, 4, 5].map((i) => row(i)), plan,
            hangLines: ['HANG: page 1 browserClose exceeded 30 s — the browser SIGKILLed; lost=none', 'HANG: page 2 leg exceeded 1200 s (leg 4) — the browser SIGKILLed; lost=4'] });
        expect(v.failed).toBe(false);
        expect(v.lines.filter((l) => l.startsWith('MERGE-WARN'))).toHaveLength(1);
    });

    it('keeps the earlier by-name failures', () => {
        const v = mergeVerdict({ rows: [row(1, 'stage-failed'), row(2, 'dirty-start'), row(3, 'page-boot-failed'), row(4), row(5)], plan });
        expect(v.lines.filter((l) => l.startsWith('MERGE-FAIL'))).toHaveLength(3);
    });
});

describe('the workflow', () => {
    const wf = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');

    it('ships the partition to the merge, which runs the verdict module', () => {
        expect(wf).toContain('test-results/divergence-sweep/plan.json');
        expect(wf).toContain('node scripts/procgen/seedlingDivergenceMerge.js merged/rows.jsonl plan/plan.json');
    });

    it('the fault injection input is EMPTY by default (inert in every real sweep)', () => {
        expect(wf).toMatch(/ {6}test_fault:\n(?: {8}.*\n)+? {8}default: ''/);
    });
});
