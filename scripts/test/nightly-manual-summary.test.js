/**
 * nightly-manual-summary.js — the nightly manual-batch run's morning read:
 * one row per batch, red when a row failed, the run did not finish its
 * roster, the job went red, or the batch left no results at all.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSummary, formatMarkdown, jobConclusions } from './nightly-manual-summary.js';

const BUDGET = 600_000;
const t0 = Date.parse('2026-11-12T10:40:00Z');
const row = (id, status, startS, endS) => ({
    id, status,
    startTime: new Date(t0 + startS * 1000).toISOString(),
    endTime: endS == null ? undefined : new Date(t0 + endS * 1000).toISOString(),
});

function results(batch, rows, notRunIds = [], extra = {}) {
    return {
        mode: 'test-substrates', batch, flavour: 'unbundled', frozen: { head: 'abcdef0123456789' },
        summary: {
            passedCount: rows.filter((r) => r.status === 'passed').length,
            failedCount: rows.filter((r) => r.status === 'failed').length,
            enabledCount: rows.length + notRunIds.length, notRunIds,
        },
        testDetails: rows, ...extra,
    };
}

let dir;
function put(batch, name, data) {
    const d = path.join(dir, `test-results-${batch}`, 'test-results', 'in-app-tests');
    mkdirSync(d, { recursive: true });
    writeFileSync(path.join(d, name), JSON.stringify(data));
}
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'nightly-summary-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const jobs = (pairs) => ({ jobs: pairs.map(([b, c]) => ({ name: `manual / Substrate tests — ${b} batch`, conclusion: c })) });

describe('jobConclusions', () => {
    it('maps the called workflow\'s job names (caller prefix and all) to batches; ignores other jobs', () => {
        expect(jobConclusions({ jobs: [
            { name: 'manual / Substrate tests — bot-walks batch', conclusion: 'success' },
            { name: 'manual / Resolve the batch', conclusion: 'success' },
            { name: 'Summary', conclusion: null, status: 'in_progress' },
        ] })).toEqual({ 'bot-walks': 'success' });
    });
});

describe('buildSummary', () => {
    it('all green: counts, OK headroom, not red', () => {
        put('noiz2sa', 'test-results-2026-11-12T10-50-00.json',
            results('noiz2sa', [row('a', 'passed', 0, 10), row('b', 'passed', 11, 20)]));
        const s = buildSummary({ batches: ['noiz2sa'], artifactsDir: dir, jobs: jobs([['noiz2sa', 'success']]), runId: 7, sha: 'abc', ref: 'main', budgetFallbackMs: BUDGET });
        expect(s.red).toBe(false);
        expect(s.batches.noiz2sa).toMatchObject({ result: 'green', passed: 2, total: 2, failing: [], headroom: { verdict: 'ok', spanMs: 20_000 } });
    });

    it('a failed row, a cut-off row and never-started rows are each named; the batch is red', () => {
        put('tutorials', 'test-results-2026-11-12T10-50-00.json', results('tutorials',
            [row('ok', 'passed', 0, 5), row('bad', 'failed', 6, 9), row('mid', 'running', 10)], ['mid', 'n1', 'n2']));
        const s = buildSummary({ batches: ['tutorials'], artifactsDir: dir, jobs: null, budgetFallbackMs: BUDGET });
        expect(s.batches.tutorials).toMatchObject({ red: true, failing: ['bad'], cutOff: ['mid'], neverStarted: ['n1', 'n2'], headroom: { verdict: 'fail' } });
        expect(s.redBatches).toEqual(['tutorials']);
    });

    it('a red JOB with every row green (a handler error, the cap) still reads red', () => {
        put('cloudberry', 'test-results-2026-11-12T10-50-00.json', results('cloudberry', [row('a', 'passed', 0, 5)]));
        const s = buildSummary({ batches: ['cloudberry'], artifactsDir: dir, jobs: jobs([['cloudberry', 'failure']]), budgetFallbackMs: BUDGET });
        expect(s.batches.cloudberry).toMatchObject({ red: true, passed: 1, total: 1, job: 'failure' });
    });

    it('a batch with no artifact is red as no-results, never silently absent', () => {
        const s = buildSummary({ batches: ['bot-walks'], artifactsDir: dir, jobs: jobs([['bot-walks', 'cancelled']]), budgetFallbackMs: BUDGET });
        expect(s.batches['bot-walks']).toMatchObject({ result: 'no-results', red: true, job: 'cancelled' });
    });

    it('grades the newest unbundled whole-batch file, skipping solo (testIds) and bundled ones', () => {
        put('noiz2sa', 'test-results-2026-11-12T10-50-00.json', results('noiz2sa', [row('a', 'failed', 0, 5)]));
        put('noiz2sa', 'test-results-2026-11-12T10-51-00.json', results('noiz2sa', [row('a', 'passed', 0, 5)]));
        put('noiz2sa', 'test-results-2026-11-12T10-52-00.json', results('noiz2sa', [row('a', 'failed', 0, 5)], [], { testIds: ['a'] }));
        put('noiz2sa', 'test-results-2026-11-12T10-53-00.json', results('noiz2sa', [row('a', 'failed', 0, 5)], [], { flavour: 'bundled' }));
        const s = buildSummary({ batches: ['noiz2sa'], artifactsDir: dir, jobs: null, budgetFallbackMs: BUDGET });
        expect(s.batches.noiz2sa).toMatchObject({ red: false, file: 'test-results-2026-11-12T10-51-00.json' });
    });
});

describe('formatMarkdown', () => {
    it('one row per batch with PASSED/total, unfinished counts and the headroom verdict; says signal-only', () => {
        put('noiz2sa', 'test-results-2026-11-12T10-50-00.json', results('noiz2sa', [row('a', 'passed', 0, 10)]));
        const md = formatMarkdown(buildSummary({ batches: ['noiz2sa', 'bot-walks'], artifactsDir: dir, jobs: null, runId: 42, sha: '0123456789abcdef', ref: 'main', budgetFallbackMs: BUDGET }));
        expect(md).toContain('RED (bot-walks)');
        expect(md).toContain('SIGNAL only');
        expect(md).toMatch(/\| noiz2sa \| 🟢 green \| 1\/1 \| — \| 0 \| OK 10 s \/ 600 s \|/);
        expect(md).toMatch(/\| bot-walks \| 🔴 no-results \| 0\/0 \|/);
    });
});
