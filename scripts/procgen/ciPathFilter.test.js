import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { ciPathFilterFor, globRe, jobScripts, pathFilterHits } from './ciPathFilter.js';
import { REPO, ciPathsIn, gateRoster } from './gateRoster.js';

describe('globRe — the @ci-paths glob grammar', () => {
    it('`**` matches any depth, and `dir/**` matches the gitlink path itself', () => {
        const re = globRe('frontend/modules/flashPanel/**');
        expect(re.test('frontend/modules/flashPanel/wasm')).toBe(true);
        expect(re.test('frontend/modules/flashPanel/a/b.js')).toBe(true);
        expect(re.test('frontend/modules/flashPanel')).toBe(true);
        expect(re.test('frontend/modules/flashPanelX/a.js')).toBe(false);
    });
    it('a literal is the path itself or anything under it', () => {
        const re = globRe('vendor/seedling');
        expect(re.test('vendor/seedling')).toBe(true);
        expect(re.test('vendor/seedling/src/a.as')).toBe(true);
        expect(re.test('vendor/seedlingx')).toBe(false);
    });
    it('`*` stays inside one segment', () => {
        const re = globRe('a/*.js');
        expect(re.test('a/b.js')).toBe(true);
        expect(re.test('a/b/c.js')).toBe(false);
    });
});

describe('jobScripts — read off the workflow job, never typed', () => {
    it('the browser-gates job runs ci-gates.mjs and the expected-red judge', () => {
        const s = jobScripts({ repo: REPO });
        expect(s).toContain('scripts/procgen/ci-gates.mjs');
        expect(s).toContain('scripts/procgen/ci-expected-red.mjs');
    });
    it('an unknown job is an error, never an empty list', () => {
        expect(() => jobScripts({ repo: REPO, job: 'no-such-job' })).toThrow(/no job/);
    });
});

describe('ciPathFilterFor — seedling-wasm-ship (js-7\'s conditions)', () => {
    const gate = gateRoster({ repo: REPO }).find((g) => g.file === 'check-seedling-wasm-ship.mjs');
    const filter = ciPathFilterFor({ gate, repo: REPO });
    const hits = (p) => pathFilterHits({ filter, changed: [p] }).length > 0;

    it('declares every tree the shipped page boots', () => {
        for (const p of ['frontend/modules/flashPanel/wasm', 'frontend/modules/flashPanel/seedlingSolveProgress.js',
            'frontend/modules/seedlingDemo/camera.js', 'frontend/modules/swfRecompilerPanel/browser',
            'vendor/seedling']) expect(hits(p), p).toBe(true);
    });
    it('derives the gate, the workflow and the scripts the job runs', () => {
        for (const p of ['scripts/procgen/check-seedling-wasm-ship.mjs', '.github/workflows/unittests_frontend.yml',
            'scripts/procgen/ci-gates.mjs', 'scripts/procgen/ci-expected-red.mjs']) expect(hits(p), p).toBe(true);
    });
    it('a docs-only or unrelated push misses it', () => {
        for (const p of ['docs/json/README.md', 'worlds/alttp/__init__.py', 'frontend/modules/apworldEditor/x.js']) {
            expect(hits(p), p).toBe(false);
        }
    });
});

/**
 * ⚖ Robert 2026-11-02 CI manual-only P4 — `@ci-paths-slice declared`: on a SLICE-branch push
 * (`ci-gates.mjs --push-scope=slice`) seedling-wasm-ship is filtered by its declared globs and its own
 * file alone; its import closure (seedlingDemo, procgenCore, shared, …) reaches it at the train.
 */
describe('P4 — @ci-paths-slice declared scopes wasm-ship on a slice push only', () => {
    const plan = (paths, scope) => {
        const dir = mkdtempSync(join(tmpdir(), 'ci-scope-'));
        const file = join(dir, 'changed.txt');
        writeFileSync(file, `${paths.join('\n')}\n`);
        try {
            const r = spawnSync(process.execPath, [join(REPO, 'scripts/procgen/ci-gates.mjs'), '--plan', '--set=browser',
                '--json', `--changed=${file}`, `--push-scope=${scope}`], { cwd: REPO, encoding: 'utf8' });
            expect(r.status, r.stderr).toBe(0);
            return JSON.parse(r.stdout).some((s) => s.name === 'seedling-wasm-ship');
        } finally { rmSync(dir, { recursive: true, force: true }); }
    };
    const gate = gateRoster({ repo: REPO }).find((g) => g.file === 'check-seedling-wasm-ship.mjs');

    it('the gate opts in, and seedlingDemo/** left its declared globs', () => {
        expect(gate.ciPaths.slice).toBe('declared');
        expect(gate.ciPaths.globs).not.toContain('frontend/modules/seedlingDemo/**');
        expect(gate.ciPaths.globs).toContain('frontend/modules/flashPanel/**');
    });
    it('a seedlingDemo-only change: RUNS on a full-scope push, SKIPPED on a slice push', () => {
        const p = ['frontend/modules/seedlingDemo/solverBot.js'];
        expect(plan(p, 'full')).toBe(true);
        expect(plan(p, 'slice')).toBe(false);
    });
    it('a declared path or the gate file itself still runs it on a slice push', () => {
        expect(plan(['frontend/modules/flashPanel/flashSeedlingGenLibrary.js'], 'slice')).toBe(true);
        expect(plan(['scripts/procgen/check-seedling-wasm-ship.mjs'], 'slice')).toBe(true);
    });
    it('the closure is kept for full scope: the filter function itself is unchanged', () => {
        const f = ciPathFilterFor({ gate, repo: REPO });
        expect(f.derived.some((p) => p.startsWith('frontend/modules/seedlingDemo/'))).toBe(true);
    });
});

describe('gateRoster.ciPathsIn — the @ci-paths-slice line', () => {
    const text = (...lines) => ['/**', ...lines.map((l) => ` * ${l}`), ' */'].join('\n');
    it('defaults to closure, reads declared, refuses the rest by name', () => {
        expect(ciPathsIn(text('@ci-paths a/**'))).toEqual({ globs: ['a/**'], slice: 'closure' });
        expect(ciPathsIn(text('@ci-paths a/**', '@ci-paths-slice declared'))).toEqual({ globs: ['a/**'], slice: 'declared' });
        expect(() => ciPathsIn(text('@ci-paths a/**', '@ci-paths-slice nope'))).toThrow(/@ci-paths-slice nope/);
        expect(() => ciPathsIn(text('@ci-paths a/**', '@ci-paths-slice declared', '@ci-paths-slice declared'))).toThrow(/2 @ci-paths-slice/);
        expect(() => ciPathsIn(text('@ci-paths-slice declared'))).toThrow(/without @ci-paths/);
    });
});
