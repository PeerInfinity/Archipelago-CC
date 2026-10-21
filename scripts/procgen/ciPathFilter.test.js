import { describe, expect, it } from 'vitest';

import { ciPathFilterFor, globRe, jobScripts, pathFilterHits } from './ciPathFilter.js';
import { REPO, gateRoster } from './gateRoster.js';

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
