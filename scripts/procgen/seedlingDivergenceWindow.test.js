/**
 * ⛓ THE SWEEP'S SOLVER KNOBS (slice `seedling-js-dash-window`; DS named `upgrade_window_work` for the JS arc):
 * `seedling-divergence-sweep.yml` inputs `upgrade_window_work` and `dash_only_window` → the probe's
 * `--upgrade-window-work` / `--dash-only-window` → the flashPanel settings written before the panel boots, so every
 * solve request the wasm engine makes carries the window as its `upgradeWindowWork` (and, ON, the worker's
 * `dashOnlyWindow` stamp). Empty = today's sweep exactly: no flag, no setting written, no stamp. Off it, every row and
 * the plan are stamped, and the merge refuses a MIXED-WINDOW merge by name, as it refuses a mixed leg budget.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SOLVER_KNOB_KEYS, parseDashOnlyWindowArg, parseUpgradeWindowWorkArg, stampSolverKnobs,
} from './probe-seedling-divergence-sweep.mjs';
import { SOLVER_KNOB_KEYS as MERGE_KEYS, mergeVerdict } from './seedlingDivergenceMerge.js';
import { DASH_ONLY_WINDOW_SETTING_KEY } from '../../frontend/modules/flashPanel/seedlingDashOnlyWindowSettings.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const PROBE = join(HERE, 'probe-seedling-divergence-sweep.mjs');
const SRC = readFileSync(PROBE, 'utf8');
const LAB = readFileSync(join(HERE, 'seedlingDivergenceLab.js'), 'utf8');
const exit = (id, level) => ({ id, level, arrive: { x: 0, y: 0 }, goal: { kind: 'exit', name: `x${id}` } });

describe('the flags', () => {
    it('empty = absent (today\'s run); a window is a whole number ≥ 0 (0 = the whole budget); dash-only is on / off', () => {
        expect(parseUpgradeWindowWorkArg('')).toBeNull();
        expect(parseUpgradeWindowWorkArg(undefined)).toBeNull();
        expect(parseUpgradeWindowWorkArg('0')).toBe(0);
        expect(parseUpgradeWindowWorkArg('130')).toBe(130);
        for (const bad of ['-1', '8.5', 'abc', '85u']) expect(() => parseUpgradeWindowWorkArg(bad)).toThrow(/^--upgrade-window-work: /);
        expect(parseDashOnlyWindowArg('')).toBeNull();
        expect(parseDashOnlyWindowArg('on')).toBe('on');
        expect(parseDashOnlyWindowArg('off')).toBe('off');
        expect(() => parseDashOnlyWindowArg('true')).toThrow(/--dash-only-window is "true"; the values are on, off/);
    });

    it('the merge module (a sparse checkout) restates the same knob keys', () => {
        expect(MERGE_KEYS).toEqual(SOLVER_KNOB_KEYS);
        expect(SOLVER_KNOB_KEYS).toEqual(['upgradeWindowWork', 'dashOnlyWindow', 'dashShape']);
    });
});

describe('the STAMP — rows and the plan', () => {
    const row = { id: 7, key: 'k', end: 'done' };

    it('with no knob set a row is byte-identical (the same object)', () => {
        expect(stampSolverKnobs(row, { upgradeWindowWork: null, dashOnlyWindow: null })).toBe(row);
        expect(stampSolverKnobs(row)).toBe(row);
    });

    it('a knob that is set is stamped (0 included), the rest untouched', () => {
        expect(stampSolverKnobs(row, { upgradeWindowWork: 0, dashOnlyWindow: null })).toEqual({ ...row, upgradeWindowWork: 0 });
        expect(stampSolverKnobs(row, { upgradeWindowWork: 85, dashOnlyWindow: 'on' })).toEqual({ ...row, upgradeWindowWork: 85, dashOnlyWindow: 'on' });
        expect(row).not.toHaveProperty('upgradeWindowWork');
    });

    it('the probe emits every row through the stamp, and writes the settings before the boot, then reads them back', () => {
        expect(SRC).toMatch(/const line = JSON\.stringify\(stampSolverKnobs\(stampBudget\(row, LEG_BUDGET\), KNOBS\)\);/);
        expect(SRC).toMatch(/const UPGRADE_WINDOW_SETTING_KEY = 'moduleSettings\.flashPanel\.seedlingSolverUpgradeWindowWork';/);
        expect(SRC).toMatch(/\[DASH_ONLY_WINDOW_SETTING_KEY, KNOBS\.dashOnlyWindow\]/);
        expect(DASH_ONLY_WINDOW_SETTING_KEY).toBe('moduleSettings.flashPanel.seedlingDashOnlyWindow');
        // the writes come before the panel tab is activated (the panel reads its settings as it boots)
        expect(SRC.indexOf('if (knobWrites.length)')).toBeLessThan(SRC.indexOf("await rp.waitFor('the flashPanel tab activated'"));
        expect(SRC).toMatch(/throw new Error\(`--upgrade-window-work asked \$\{KNOBS\.upgradeWindowWork\}; the panel holds/);
        expect(SRC).toMatch(/throw new Error\(`--dash-only-window asked \$\{KNOBS\.dashOnlyWindow \?\? 'default'\}; the panel holds/);
        // the plans carry the stamp the WORKER solved under
        expect(LAB).toMatch(/typeof s\.res\?\.dashOnlyWindow === 'boolean' \? \{ dashOnlyWindow: s\.res\.dashOnlyWindow \}/);
        expect(LAB).toMatch(/getDashOnlyWindow: \(\) => surface\(\)\?\.wasm\?\.dashOnlyWindow \?\? null,/);
    });
});

describe('the plan job (--shard-plan --json)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'window-knob-'));
    const legs = join(dir, 'legs.jsonl');
    writeFileSync(legs, `${[exit(0, 40), exit(1, 41), exit(2, 5)].map((l) => JSON.stringify(l)).join('\n')}\n`);
    const plan = (...extra) => execFileSync('node', [PROBE, `--legs=${legs}`, '--shard-plan=2', '--page-legs=1', '--json', ...extra],
        { cwd: REPO, encoding: 'utf8' });

    it('empty flags are byte-identical to no flag (no stamp); set, the plan is stamped', () => {
        const today = plan();
        expect(plan('--upgrade-window-work=', '--dash-only-window=')).toBe(today);
        expect(JSON.parse(today)).not.toHaveProperty('upgradeWindowWork');
        const p = JSON.parse(plan('--upgrade-window-work=0', '--dash-only-window=on'));
        expect([p.upgradeWindowWork, p.dashOnlyWindow]).toEqual([0, 'on']);
        expect({ ...p, upgradeWindowWork: undefined, dashOnlyWindow: undefined }).toEqual({ ...JSON.parse(today), upgradeWindowWork: undefined, dashOnlyWindow: undefined });
    });
});

describe('the MERGE refuses a mixed-window merge by name', () => {
    const planOf = (knobs = {}) => stampSolverKnobs({ legs: 2, shards: [{ shard: 1, ids: [1, 2] }] }, knobs);
    const r = (id, knobs = {}) => stampSolverKnobs({ id, end: 'done' }, knobs);

    it('the default merge prints exactly today\'s lines', () => {
        const v = mergeVerdict({ rows: [r(1), r(2)], plan: planOf() });
        expect(v.failed).toBe(false);
        expect(v.lines).toEqual(['MERGE: 2 rows, 2 distinct legs of 2; ends {"done":2}']);
    });

    it('an off-default merge, every row stamped: green, and the knob named', () => {
        const k = { upgradeWindowWork: 0, dashOnlyWindow: 'on' };
        const v = mergeVerdict({ rows: [r(1, k), r(2, k)], plan: planOf(k) });
        expect(v.failed).toBe(false);
        expect(v.lines).toContain('SOLVER-KNOB: upgradeWindowWork 0 (off today\'s)');
        expect(v.lines).toContain('SOLVER-KNOB: dashOnlyWindow on (off today\'s)');
    });

    it('rows at two windows: MERGE-FAIL, naming the plan\'s window and each other window\'s ids', () => {
        const v = mergeVerdict({ rows: [r(1, { upgradeWindowWork: 0 }), r(2)], plan: planOf({ upgradeWindowWork: 0 }) });
        expect(v.failed).toBe(true);
        expect(v.lines).toContain('MERGE-FAIL: a MIXED-WINDOW merge: the plan\'s upgradeWindowWork is 0, and 1 row(s) ran at unset (ids 2)');
        const w = mergeVerdict({ rows: [r(1), r(2, { upgradeWindowWork: 130 })], plan: planOf() });
        expect(w.lines).toContain('MERGE-FAIL: a MIXED-WINDOW merge: the plan\'s upgradeWindowWork is unset, and 1 row(s) ran at 130 (ids 2)');
    });

    it('a mixed dash-only merge fails the same way', () => {
        const v = mergeVerdict({ rows: [r(1, { dashOnlyWindow: 'on' }), r(2, { dashOnlyWindow: 'off' })], plan: planOf({ dashOnlyWindow: 'on' }) });
        expect(v.failed).toBe(true);
        expect(v.lines).toContain('MERGE-FAIL: a MIXED-WINDOW merge: the plan\'s dashOnlyWindow is on, and 1 row(s) ran at off (ids 2)');
    });
});

describe('seedling-divergence-sweep.yml — upgrade_window_work, dash_only_window', () => {
    const text = readFileSync(join(REPO, '.github/workflows/seedling-divergence-sweep.yml'), 'utf8');

    it('are inputs whose default is EMPTY (an unset input runs today\'s sweep: no flag at all)', () => {
        for (const input of ['upgrade_window_work', 'dash_only_window']) {
            expect(text).toMatch(new RegExp(` {6}${input}:\\n {8}description: >-\\n(?: {10}.*\\n)+ {8}type: string\\n {8}default: ''\\n`));
        }
    });

    it('reach the plan (both calls) and every shard, only when set', () => {
        expect(text.match(/UPGRADE_WINDOW: \$\{\{ inputs\.upgrade_window_work \}\}/g)).toHaveLength(2);
        expect(text.match(/DASH_ONLY: \$\{\{ inputs\.dash_only_window \}\}/g)).toHaveLength(2);
        expect(text.match(/\$\{UPGRADE_WINDOW:\+--upgrade-window-work="\$UPGRADE_WINDOW"\} \$\{DASH_ONLY:\+--dash-only-window="\$DASH_ONLY"\}/g)).toHaveLength(3);
    });
});
