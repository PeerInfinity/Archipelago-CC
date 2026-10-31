/**
 * ⛓ CPWIT — THE SWEEP'S SOLVER-ENV INPUT (measurement only): `seedling-divergence-sweep.yml` input `solver_env` → the
 * probe's `--solver-env=<spec>` → the page URL's `?seedlingSolverEnv=` → the page's solve worker
 * (`solverEnvChannel.js`, rows in `frontend/modules/seedlingDemo/solverEnvChannel.test.js`). Empty = today's sweep
 * exactly: no flag, no URL param, no stamp. Off it, every row and the plan are stamped `solverEnv` (the canonical spec),
 * the page's spec is read back at the boot, a plan the worker solved under another spec fails its leg by name, and the
 * merge refuses a mixed merge by name.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseSolverEnvArg, stampSolverKnobs } from './probe-seedling-divergence-sweep.mjs';
import { mergeVerdict } from './seedlingDivergenceMerge.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PROBE = join(HERE, 'probe-seedling-divergence-sweep.mjs');
const SRC = readFileSync(PROBE, 'utf8');
const LAB = readFileSync(join(HERE, 'seedlingDivergenceLab.js'), 'utf8');
const YML = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');
const CPAIR3 = 'SEEDLING_CHOOSER_PAIR=1;SEEDLING_CHOOSER_PAIR_SIZE=3';
const exit = (id, level) => ({ id, level, arrive: { x: 0, y: 0 }, goal: { kind: 'exit', name: `x${id}` } });

describe('--solver-env', () => {
    it('empty = absent; a spec is canonical (names sorted); an unknown name fails by name', () => {
        expect(parseSolverEnvArg('')).toBeNull();
        expect(parseSolverEnvArg(undefined)).toBeNull();
        expect(parseSolverEnvArg('SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_CHOOSER_PAIR=1')).toBe(CPAIR3);
        expect(() => parseSolverEnvArg('SEEDLING_NOPE=1')).toThrow(/^--solver-env: unknown switch "SEEDLING_NOPE"/);
    });

    it('a row is stamped only when it is set', () => {
        const row = { id: 1, end: 'done' };
        expect(stampSolverKnobs(row, { solverEnv: null })).toBe(row);
        expect(stampSolverKnobs(row, { solverEnv: CPAIR3 })).toEqual({ ...row, solverEnv: CPAIR3 });
    });

    it('the probe puts it on the page URL, reads it back, and holds each plan to it; the lab carries the worker\'s stamp', () => {
        expect(SRC).toMatch(/const envQuery = KNOBS\.solverEnv \? `&\$\{SOLVER_ENV_PARAM\}=\$\{encodeURIComponent\(KNOBS\.solverEnv\)\}` : '';/);
        expect(SRC).toMatch(/AP_1_rules\.json\$\{envQuery\}`/);
        expect(SRC).toMatch(/throw new Error\(`--solver-env asked \$\{KNOBS\.solverEnv \?\? 'default'\}; the page holds/);
        expect(SRC).toMatch(/plan\(s\) `\n\s+\+ `were solved under/);
        expect(LAB).toMatch(/typeof s\.res\?\.solverEnv === 'string' \? \{ solverEnv: s\.res\.solverEnv \}/);
    });

    it('the workflow passes its `solver_env` input (default empty) to the plan job and every shard', () => {
        expect(YML).toMatch(/\n {6}solver_env:\n(?: {8}.*\n)*? {8}default: ''\n/);
        expect(YML.match(/\$\{SOLVER_ENV:\+--solver-env="\$SOLVER_ENV"\}/g)?.length).toBe(3);
        expect(YML.match(/SOLVER_ENV: \$\{\{ inputs\.solver_env \}\}/g)?.length).toBe(2);
    });
});

describe('the plan job (--shard-plan --json)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'solver-env-'));
    const legs = join(dir, 'legs.jsonl');
    writeFileSync(legs, `${[exit(0, 40), exit(1, 41)].map((l) => JSON.stringify(l)).join('\n')}\n`);
    const plan = (...extra) => execFileSync('node', [PROBE, `--legs=${legs}`, '--shard-plan=2', '--page-legs=1', '--json', ...extra],
        { cwd: REPO, encoding: 'utf8' });

    it('an empty flag is byte-identical to no flag; set, the plan is stamped with the canonical spec', () => {
        const today = plan();
        expect(plan('--solver-env=')).toBe(today);
        const p = JSON.parse(plan('--solver-env=SEEDLING_CHOOSER_PAIR_SIZE=3;SEEDLING_CHOOSER_PAIR=1'));
        expect(p.solverEnv).toBe(CPAIR3);
        expect({ ...p, solverEnv: undefined }).toEqual({ ...JSON.parse(today), solverEnv: undefined });
    });
});

describe('the MERGE refuses a mixed solver-env merge by name', () => {
    const planOf = (knobs = {}) => stampSolverKnobs({ legs: 2, shards: [{ shard: 1, ids: [1, 2] }] }, knobs);
    const r = (id, knobs = {}) => stampSolverKnobs({ id, end: 'done' }, knobs);

    it('every row under the plan\'s spec: green, and the spec named', () => {
        const k = { solverEnv: CPAIR3 };
        const v = mergeVerdict({ rows: [r(1, k), r(2, k)], plan: planOf(k) });
        expect(v.failed).toBe(false);
        expect(v.lines).toContain(`SOLVER-KNOB: solverEnv ${CPAIR3} (off today's)`);
    });

    it('a defaults row in a switched merge (and the reverse): MERGE-FAIL, naming the ids', () => {
        const v = mergeVerdict({ rows: [r(1, { solverEnv: CPAIR3 }), r(2)], plan: planOf({ solverEnv: CPAIR3 }) });
        expect(v.failed).toBe(true);
        expect(v.lines).toContain(`MERGE-FAIL: a MIXED-WINDOW merge: the plan's solverEnv is ${CPAIR3}, and 1 row(s) ran at unset (ids 2)`);
        const w = mergeVerdict({ rows: [r(1), r(2, { solverEnv: CPAIR3 })], plan: planOf() });
        expect(w.failed).toBe(true);
    });
});
