/**
 * check-batch-headroom.js — warn / fail thresholds on fixture results.
 *
 * The CLI reads `test-results/in-app-tests/` under its cwd, so the CLI rows run
 * it in a child process whose cwd is a temp tree of fixture runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HEADROOM_WARN_FRACTION, assessRun, defaultBudgetMs } from './check-batch-headroom.js';

vi.mock('../../frontend/modules/stateManager/index.js', () => ({ stateManagerProxySingleton: {} }));

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-batch-headroom.js');
const BUDGET = 600000;
const T0 = Date.parse('2026-10-09T00:00:00.000Z');

/** A run whose rows span `spanMs` in total (two rows, back to back). */
function run({ spanMs, batch = 'fast', mode = 'test-substrates', summary = {}, rows, ...rest }) {
    const half = Math.floor(spanMs / 2);
    const at = (ms) => new Date(T0 + ms).toISOString();
    return {
        mode, batch, testIds: null, flavour: 'unbundled', ...rest,
        summary: { totalRun: 2, notRunCount: 0, notRunIds: [], ...summary },
        testDetails: rows ?? [
            { id: 'row-a', status: 'passed', startTime: at(0), endTime: at(half), durationMs: half },
            { id: 'row-b', status: 'passed', startTime: at(half), endTime: at(spanMs), durationMs: spanMs - half },
        ],
    };
}

describe('assessRun', () => {
    it('the warn threshold is a named fraction below the budget', () => {
        expect(HEADROOM_WARN_FRACTION).toBeGreaterThan(0);
        expect(HEADROOM_WARN_FRACTION).toBeLessThan(1);
    });

    it('OK below the warn fraction', () => {
        const r = assessRun(run({ spanMs: BUDGET * HEADROOM_WARN_FRACTION - 1000 }), BUDGET);
        expect(r.verdict).toBe('ok');
        expect(r.reasons).toEqual([]);
    });

    it('WARN past the warn fraction, still inside the budget', () => {
        const r = assessRun(run({ spanMs: BUDGET * HEADROOM_WARN_FRACTION + 1000 }), BUDGET);
        expect(r.verdict).toBe('warn');
        expect(r.reasons.join()).toMatch(/split the batch/);
    });

    it('FAIL past the budget', () => {
        const r = assessRun(run({ spanMs: BUDGET + 1000 }), BUDGET);
        expect(r.verdict).toBe('fail');
        expect(r.reasons.join()).toMatch(/exceeds the budget/);
    });

    it('FAIL on NEVER STARTED rows, however short the span', () => {
        const r = assessRun(run({ spanMs: 1000, summary: { notRunCount: 1, notRunIds: ['row-c'] } }), BUDGET);
        expect(r.verdict).toBe('fail');
        expect(r.reasons.join()).toMatch(/NEVER STARTED \(1\): row-c/);
    });

    it('FAIL on a row CUT OFF mid-test, named apart from the never-started', () => {
        const rows = [
            { id: 'row-a', status: 'passed', startTime: new Date(T0).toISOString(), endTime: new Date(T0 + 1000).toISOString() },
            { id: 'row-b', status: 'running', startTime: new Date(T0 + 1000).toISOString() },
            { id: 'row-c', status: 'pending' },
        ];
        const r = assessRun(run({
            spanMs: 0, rows,
            summary: { timedOut: true, error: 'Auto-start timeout after 600 seconds', notRunIds: ['row-b', 'row-c'] },
        }), BUDGET);
        expect(r.verdict).toBe('fail');
        expect(r.reasons).toContain('CUT OFF mid-test: row-b');
        expect(r.reasons).toContain('NEVER STARTED (1): row-c');
        expect(r.reasons.join()).toMatch(/timed out/);
    });

    it('grades against the run\'s own stamped budget when it was overridden', () => {
        const r = assessRun(run({ spanMs: 50000, budgetMs: 60000 }), BUDGET);
        expect(r.budgetMs).toBe(60000);
        expect(r.verdict).toBe('warn');
    });

    it('a failed ROW is not a headroom failure (that is the run\'s own verdict)', () => {
        const d = run({ spanMs: 1000 });
        d.testDetails[0].status = 'failed';
        expect(assessRun(d, BUDGET).verdict).toBe('ok');
    });
});

describe('defaultBudgetMs', () => {
    it('reads the same value testLogic.js exports', async () => {
        const { AUTO_START_TIMEOUT_MS } = await import('../../frontend/modules/tests/testLogic.js');
        expect(defaultBudgetMs()).toBe(AUTO_START_TIMEOUT_MS);
    });

    it('throws when the constant cannot be found', () => {
        expect(() => defaultBudgetMs('export const SOMETHING_ELSE = 1;')).toThrow(/AUTO_START_TIMEOUT_MS not found/);
    });
});

describe('the CLI', () => {
    let cwd;
    let dir;
    beforeEach(() => {
        cwd = mkdtempSync(path.join(tmpdir(), 'batch-headroom-'));
        dir = path.join(cwd, 'test-results', 'in-app-tests');
        mkdirSync(dir, { recursive: true });
    });
    afterEach(() => rmSync(cwd, { recursive: true, force: true }));

    const put = (name, body) => writeFileSync(path.join(dir, `test-results-${name}.json`), JSON.stringify(body));
    const cli = (...args) => {
        const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });
        return { exit: r.status, out: `${r.stdout}${r.stderr}` };
    };

    it('exit 2 when nothing matches — nothing graded is not green', () => {
        expect(cli('--mode=test-substrates', '--batch=fast').exit).toBe(2);
    });

    it('grades the NEWEST run of the batch, not an older one', () => {
        put('2026-10-09T00-00-00', run({ spanMs: BUDGET + 1000 }));
        put('2026-10-09T01-00-00', run({ spanMs: 1000 }));
        const r = cli('--mode=test-substrates', '--batch=fast');
        expect(r.exit).toBe(0);
        expect(r.out).toMatch(/HEADROOM OK test-substrates\/fast/);
    });

    it('a solo --test run and another batch are not the batch\'s run', () => {
        put('2026-10-09T00-00-00', run({ spanMs: BUDGET + 1000 }));
        put('2026-10-09T01-00-00', { ...run({ spanMs: 1000 }), testIds: 'row-a' });
        put('2026-10-09T02-00-00', run({ spanMs: 1000, batch: 'apworld' }));
        const r = cli('--mode=test-substrates', '--batch=fast');
        expect(r.exit).toBe(1);
        expect(r.out).toMatch(/HEADROOM FAIL test-substrates\/fast/);
    });

    it('no --batch grades every batch\'s newest run; one failure fails the check', () => {
        put('2026-10-09T00-00-00', run({ spanMs: 1000, batch: 'apworld' }));
        put('2026-10-09T01-00-00', run({ spanMs: 1000, summary: { notRunIds: ['row-z'] } }));
        const r = cli('--mode=test-substrates');
        expect(r.exit).toBe(1);
        expect(r.out).toMatch(/OK test-substrates\/apworld/);
        expect(r.out).toMatch(/FAIL test-substrates\/fast/);
    });

    it('a warning exits 0 and annotates on CI', () => {
        put('2026-10-09T00-00-00', run({ spanMs: BUDGET * HEADROOM_WARN_FRACTION + 1000 }));
        const r = spawnSync(process.execPath, [CLI, '--batch=fast'], {
            cwd, encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: 'true' },
        });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/^::warning::HEADROOM WARN/m);
    });
});
