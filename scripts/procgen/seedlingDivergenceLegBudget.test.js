/**
 * S5-1 — THE LEG BUDGET: the sweep's per-leg wall clock (`serveLeg`'s loop, 90 s hard-coded until now) is a STAMPED
 * switch. A long search read `timeout` exactly like an impossible one (sweep-5: L40 378/381/397/414 — the 2560-unit
 * held retry `cancelled` at 90 s). At the default every row and the plan are byte-identical to today's; off it, every
 * row carries `legBudgetMs`, a `timeout` row names its bound, the bounds above a leg grow with it, and the merge
 * refuses a mixed-budget merge by name.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    HANG_BOUNDS_MS, JOB_TIMEOUT_CEILING_MIN, LEG_BUDGET_MS_DEFAULT, hangRow, legHangBoundMs, parseLegBudgetMs,
    shardTimeoutMinutes, stampBudget,
} from './probe-seedling-divergence-sweep.mjs';
import { LEG_BUDGET_MS_DEFAULT as MERGE_DEFAULT, mergeVerdict } from './seedlingDivergenceMerge.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PROBE = join(HERE, 'probe-seedling-divergence-sweep.mjs');
const SRC = readFileSync(PROBE, 'utf8');
const LAB = readFileSync(join(HERE, 'seedlingDivergenceLab.js'), 'utf8');
const exit = (id, level) => ({ id, level, arrive: { x: 0, y: 0 }, goal: { kind: 'exit', name: `x${id}` } });

describe('--leg-budget-ms', () => {
    it('empty is the default, 90000 ms (today\'s sweep); the merge module holds the same default', () => {
        expect(LEG_BUDGET_MS_DEFAULT).toBe(90000);
        expect(parseLegBudgetMs('')).toBe(90000);
        expect(parseLegBudgetMs(undefined)).toBe(90000);
        expect(MERGE_DEFAULT).toBe(LEG_BUDGET_MS_DEFAULT);
        expect(parseLegBudgetMs('300000')).toBe(300000);
    });

    it('a value that is not a whole number of ms ≥ 1000 fails by name', () => {
        for (const bad of ['abc', '300s', '-5', '999', '1.5e5']) {
            expect(() => parseLegBudgetMs(bad)).toThrow(/^--leg-budget-ms: .* is not a whole number of ms ≥ 1000$/);
        }
    });
});

describe('the STAMP', () => {
    const row = { id: 7, key: 'k', end: 'timeout', ms: 90012 };

    it('at the default a row is byte-identical (the same object, the same JSON)', () => {
        expect(stampBudget(row, 90000)).toBe(row);
        expect(JSON.stringify(stampBudget(row, LEG_BUDGET_MS_DEFAULT))).toBe(JSON.stringify(row));
        const hung = hangRow(exit(3, 40), { mode: 'inv', producer: 'solver', page: 1, pageLeg: 0, step: 'leg', ms: 1200000, started: true });
        expect(JSON.stringify(stampBudget(hung, 90000))).toBe(JSON.stringify(hung));
    });

    it('off the default EVERY row carries legBudgetMs (a run row and a hang row), the rest untouched', () => {
        expect(stampBudget(row, 300000)).toEqual({ ...row, legBudgetMs: 300000 });
        expect(row).not.toHaveProperty('legBudgetMs');
        const hung = hangRow(exit(3, 40), { mode: 'inv', producer: 'solver', page: 1, pageLeg: 0, step: 'leg', ms: 1410000, started: true });
        expect(stampBudget(hung, 300000).legBudgetMs).toBe(300000);
    });

    it('the probe emits EVERY row through the stamp (the one door: run, skipped, boot-failed, hang rows)', () => {
        // ⛓ DASH-ONLY WINDOW — the solver knobs' stamp wraps the same door (`seedlingDivergenceWindow.test.js`)
        expect(SRC).toMatch(/const line = JSON\.stringify\(stampSolverKnobs\(stampBudget\(row, LEG_BUDGET\), KNOBS\)\);/);
        // emit's one write: no row reaches the file another way (the other writes are the REQUEST CAPTURE's and the
        // MEMORY PROBE's own files)
        expect(SRC.match(/appendFileSync\(OUT,/g)).toHaveLength(1);
        expect(SRC.match(/appendFileSync\(/g)).toHaveLength(3);
        expect(SRC).toMatch(/if \(CAPTURE\) appendFileSync\(CAPTURE, /);
        expect(SRC).toMatch(/if \(MEM_OUT\) appendFileSync\(MEM_OUT, /);
    });

    it('the serve gets the budget (no literal 90000 left at the call) and names a cut only off the default', () => {
        expect(SRC).toMatch(/\{ leg, budgetMs: LEG_BUDGET, producer: PRODUCER, nameCut: LEG_BUDGET !== LEG_BUDGET_MS_DEFAULT,/);
        expect(SRC).not.toMatch(/budgetMs: 90000/);
        expect(LAB).toMatch(/const cut = nameCut && end === 'timeout' \? \{ bound: 'leg-budget', budgetMs, phase: eng\.status\(\)\.phase,/);
        expect(LAB).toMatch(/\.\.\.\(cut \? \{ cut \} : \{\}\)/);
    });
});

describe('the bounds ABOVE a leg grow with its budget', () => {
    it('the leg hang bound: the measured 1200 s at the default, + the budget\'s excess off it', () => {
        expect(legHangBoundMs(90000)).toBe(HANG_BOUNDS_MS.leg);
        expect(legHangBoundMs(300000)).toBe(HANG_BOUNDS_MS.leg + 210000);
        expect(legHangBoundMs(30000)).toBe(HANG_BOUNDS_MS.leg);
        expect(SRC).toMatch(/const BOUNDS = \{ \.\.\.HANG_BOUNDS_MS, leg: legHangBoundMs\(LEG_BUDGET\) \};/);
        expect(SRC).toMatch(/await bounded\(name, BOUNDS\[name\], injected/);
    });

    it('the shard timeout: today\'s estimate at the default; off it, floored by every leg spending its whole budget', () => {
        const shards = [{ ids: [1, 2, 3, 4], pages: 4 }, { ids: [5], pages: 1 }];
        expect(shardTimeoutMinutes({ maxPrice: 300, shards, legBudgetMs: 90000 })).toBe(Math.ceil((300 * 4) / 60) + 20);
        // 4 legs × (300 + 60) s + 4 pages × 60 s = 1680 s = 28 min, + 20
        expect(shardTimeoutMinutes({ maxPrice: 300, shards, legBudgetMs: 300000 })).toBe(48);
        // a cheap estimate never lowers the floor; a pricier one wins
        expect(shardTimeoutMinutes({ maxPrice: 3000, shards, legBudgetMs: 300000 })).toBe(220);
    });

    it('a budget whose worst shard passes the job ceiling fails the plan by name', () => {
        const shards = [{ ids: Array.from({ length: 60 }, (_, i) => i), pages: 60 }];
        expect(() => shardTimeoutMinutes({ maxPrice: 100, shards, legBudgetMs: 300000 }))
            .toThrow(new RegExp(`over the job's ${JOB_TIMEOUT_CEILING_MIN}-min ceiling`));
    });
});

describe('the plan job (--shard-plan --json)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'leg-budget-'));
    const legs = join(dir, 'legs.jsonl');
    writeFileSync(legs, `${[exit(0, 40), exit(1, 41), exit(2, 5), exit(3, 12)].map((l) => JSON.stringify(l)).join('\n')}\n`);
    const plan = (...extra) => execFileSync('node', [PROBE, `--legs=${legs}`, '--shard-plan=2', '--page-legs=1', '--json', ...extra],
        { cwd: REPO, encoding: 'utf8' });

    it('--leg-budget-ms=90000 is byte-identical to no flag (the default plan has no stamp)', () => {
        const today = plan();
        expect(plan('--leg-budget-ms=90000')).toBe(today);
        expect(JSON.parse(today)).not.toHaveProperty('legBudgetMs');
    });

    it('off the default the plan is stamped and its timeout covers the budget', () => {
        const p = JSON.parse(plan('--leg-budget-ms=300000'));
        expect(p.legBudgetMs).toBe(300000);
        // 2 legs per shard × (300 + 60) s + 2 page boots × 60 s = 840 s = 14 min, + 20
        expect(p.timeoutMinutes).toBeGreaterThanOrEqual(34);
    });
});

describe('the MERGE refuses a mixed-budget merge by name', () => {
    const planOf = (budget) => ({ legs: 2, shards: [{ shard: 1, ids: [1, 2] }], ...(budget ? { legBudgetMs: budget } : {}) });
    const r = (id, budget) => stampBudget({ id, end: 'timeout' }, budget);

    it('the default merge prints exactly today\'s lines (no budget line)', () => {
        const v = mergeVerdict({ rows: [r(1, 90000), r(2, 90000)], plan: planOf() });
        expect(v.failed).toBe(false);
        // ⛓ the runner stamp (slice `seedling-js-runner-stamp`) adds one TIMEOUT line per timeout row, nothing else here
        expect(v.lines.filter((l) => !l.startsWith('TIMEOUT: '))).toEqual(['MERGE: 2 rows, 2 distinct legs of 2; ends {"timeout":2}']);
        expect(v.lines.filter((l) => l.startsWith('TIMEOUT: '))).toHaveLength(2);
    });

    it('an off-default merge, every row stamped: green, and the budget named', () => {
        const v = mergeVerdict({ rows: [r(1, 300000), r(2, 300000)], plan: planOf(300000) });
        expect(v.failed).toBe(false);
        expect(v.lines).toContain('LEG-BUDGET: 300000 ms per leg (off the 90000 ms default)');
    });

    it('rows at two budgets: MERGE-FAIL, naming each budget and its ids', () => {
        const v = mergeVerdict({ rows: [r(1, 300000), r(2, 90000)], plan: planOf(300000) });
        expect(v.failed).toBe(true);
        expect(v.lines).toContain('MERGE-FAIL: a MIXED-BUDGET merge: the plan\'s leg budget is 300000 ms, and 1 row(s) ran at 90000 ms (ids 2)');
    });

    it('⛔ THE MUTANT — the stamp dropped: an off-default run\'s unstamped rows read as 90000 and fail BY NAME', () => {
        const v = mergeVerdict({ rows: [{ id: 1, end: 'timeout' }, { id: 2, end: 'done' }], plan: planOf(300000) });
        expect(v.failed).toBe(true);
        expect(v.lines.find((l) => l.startsWith('MERGE-FAIL'))).toMatch(/MIXED-BUDGET merge: the plan's leg budget is 300000 ms, and 2 row\(s\) ran at 90000 ms/);
    });

    it('stamped rows under a default plan (a re-dispatch at another budget merged into today\'s) fail too', () => {
        const v = mergeVerdict({ rows: [r(1, 90000), r(2, 300000)], plan: planOf() });
        expect(v.failed).toBe(true);
        expect(v.lines.some((l) => /MIXED-BUDGET.*ran at 300000 ms \(ids 2\)/.test(l))).toBe(true);
    });
});

describe('seedling-divergence-sweep.yml — leg_budget_ms', () => {
    const text = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');

    it('is an input whose default is EMPTY (an unset input runs today\'s sweep: no flag at all)', () => {
        expect(text).toMatch(/ {6}leg_budget_ms:\n {8}description: >-\n(?: {10}.*\n)+ {8}type: string\n {8}default: ''\n/);
    });

    it('reaches the plan (both calls) and every shard, only when set', () => {
        expect(text.match(/LEG_BUDGET: \$\{\{ inputs\.leg_budget_ms \}\}/g)).toHaveLength(2);
        expect(text.match(/\$\{LEG_BUDGET:\+--leg-budget-ms="\$LEG_BUDGET"\}/g)).toHaveLength(3);
    });
});
