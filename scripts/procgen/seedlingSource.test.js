/**
 * seedlingSource — **THE ROWS: A SEEDLING-READING INSTRUMENT READS THE FLAG OR
 * THE `vendor/seedling` SUBMODULE, OR IT SAYS BY NAME THAT THE SUBMODULE IS NOT
 * INITIALISED** (slices seedling-headless-E1, V1).
 *
 * ⛓ The spawned rows run the tools from a FIXTURE REPOSITORY — a copy of
 * `scripts/procgen/` and `package.json` in a scratch directory, with `frontend/`
 * and `node_modules/` linked in — because the tools find the submodule beside
 * their own file. This tree's `vendor/seedling` is initialised (CI's too), so a
 * refusal row run in place could never refuse; the fixture decides whether a
 * `vendor/seedling` exists and whether it is initialised.
 */
import { spawnSync } from 'node:child_process';
import {
    cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    SEEDLING_REPO, SEEDLING_SUBMODULE, seedlingSource, seedlingSourceRefusal, seedlingSubmodule,
} from './seedlingSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** A scratch repository root; `submodule` is 'absent', 'empty' (uninitialised) or 'initialised'. */
function scratchRepo(submodule) {
    const root = mkdtempSync(join(tmpdir(), 'seedling-source-repo-'));
    if (submodule !== 'absent') mkdirSync(join(root, SEEDLING_SUBMODULE), { recursive: true });
    if (submodule === 'initialised') {
        writeFileSync(join(root, SEEDLING_SUBMODULE, '.git'), 'gitdir: ../../.git/modules/vendor/seedling\n');
    }
    return root;
}

/** …plus the tools: a copy of `scripts/procgen/`, with `frontend/` and `node_modules/` linked. */
function fixtureRepo(submodule) {
    const root = scratchRepo(submodule);
    cpSync(HERE, join(root, 'scripts', 'procgen'), { recursive: true });
    cpSync(join(REPO, 'package.json'), join(root, 'package.json'));
    for (const dir of ['frontend', 'node_modules']) {
        if (existsSync(join(REPO, dir))) symlinkSync(join(REPO, dir), join(root, dir), 'dir');
    }
    return root;
}

function runIn(root, cmd, tool, args) {
    const r = spawnSync(cmd, [join(root, 'scripts', 'procgen', tool), ...args],
        { cwd: root, encoding: 'utf8', timeout: 60000 });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('seedlingSource: the flag, then the INITIALISED submodule, then nothing', () => {
    const roots = [];
    const repo = (submodule) => { const r = scratchRepo(submodule); roots.push(r); return r; };
    afterAll(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

    it('the submodule path is the one .gitmodules declares — a tracked pin, not a layout guess', () => {
        expect(SEEDLING_SUBMODULE).toBe('vendor/seedling');
        expect(readFileSync(join(REPO, '.gitmodules'), 'utf8')).toMatch(/^\s*path = vendor\/seedling$/m);
    });

    it('initialised: nothing named resolves to <repo>/vendor/seedling', () => {
        const root = repo('initialised');
        expect(seedlingSubmodule(root)).toBe(resolve(root, SEEDLING_SUBMODULE));
        expect(seedlingSource(null, { repo: root })).toBe(resolve(root, SEEDLING_SUBMODULE));
    });

    it('UNinitialised (the empty directory a clone without submodules leaves) or absent: null', () => {
        const empty = repo('empty');
        mkdirSync(join(empty, SEEDLING_SUBMODULE, 'src'));
        expect(seedlingSource(null, { repo: empty })).toBeNull();
        expect(seedlingSource('', { repo: repo('absent') })).toBeNull();
    });

    it('the flag beats the submodule', () => {
        expect(seedlingSource('/from-flag', { repo: repo('initialised') })).toBe(resolve('/from-flag'));
        expect(seedlingSource('/from-flag', { repo: repo('absent') })).toBe(resolve('/from-flag'));
    });

    const INITIALISED = existsSync(join(REPO, SEEDLING_SUBMODULE, '.git'));
    it.skipIf(!INITIALISED)('THIS tree (initialised): the default is its own vendor/seedling', () => {
        expect(seedlingSource(null)).toBe(resolve(REPO, SEEDLING_SUBMODULE));
    });
});

describe('the tools, run from a fixture repository', () => {
    let uninit;
    let init;
    beforeAll(() => { uninit = fixtureRepo('empty'); init = fixtureRepo('initialised'); });
    afterAll(() => { for (const r of [uninit, init]) rmSync(r, { recursive: true, force: true }); });

    describe('⛔ an instrument with the submodule uninitialised REFUSES by name, exit 2', () => {
        const NODE_TOOLS = [
            ['extract-seedling-masks.mjs', ['--check']],
            ['extract-seedling-damage-sites.mjs', ['--check']],
            ['recon-seedling-r5.mjs', ['--kill-locks']],
        ];
        for (const [tool, args] of NODE_TOOLS) {
            it(`${tool} ${args.join(' ')}`, () => {
                const r = runIn(uninit, process.execPath, tool, args);
                expect(r.stderr.trim()).toBe(seedlingSourceRefusal(tool));
                expect(r.status).toBe(2);
            });
        }

        const PY_TOOLS = ['extract-seedling-ogmo-schema.py', 'extract-seedling-vanilla-set.py'];
        for (const tool of PY_TOOLS) {
            it(`${tool} --stdout (the same words, spelled in Python)`, () => {
                const r = runIn(uninit, 'python3', tool, ['--stdout']);
                expect(r.stderr.trim()).toBe(seedlingSourceRefusal(tool));
                expect(r.status).toBe(2);
            });
        }
    });

    describe('an INITIALISED submodule is where the tools read', () => {
        it('damage-sites --check reads <repo>/vendor/seedling/src', () => {
            const r = runIn(init, process.execPath, 'extract-seedling-damage-sites.mjs', ['--check']);
            expect(r.stderr).toContain(join(init, SEEDLING_SUBMODULE, 'src'));
            expect(r.status).not.toBe(0);
        });

        it('a PYTHON tool reads it too (the copy keeps the order)', () => {
            const r = runIn(init, 'python3', 'extract-seedling-vanilla-set.py', ['--stdout']);
            expect(r.stderr).toContain(join(init, SEEDLING_SUBMODULE, 'src'));
            expect(r.status).not.toBe(0);
        });

        it('the flag still names another checkout (the Python copy honours it first)', () => {
            const r = runIn(init, 'python3', 'extract-seedling-vanilla-set.py',
                ['--seedling', '/nonexistent-flag-checkout', '--stdout']);
            expect(r.stderr).toContain('/nonexistent-flag-checkout/src');
            expect(r.status).not.toBe(0);
        });
    });

    describe('a probe whose checkout is OPTIONAL skips, and the skip names the submodule', () => {
        it('probe-seedling-ctor-args.mjs', () => {
            const r = runIn(uninit, process.execPath, 'probe-seedling-ctor-args.mjs', []);
            expect(r.stdout).toMatch(/^SKIP: the vendor\/seedling submodule is not initialised/);
            expect(r.status).toBe(0);
        });
    });
});

describe('a probe whose recompiler checkout is OPTIONAL skips by name', () => {
    it('check-dj-swf-patch.mjs (SWFRECOMP_CC, the recompiler checkout)', () => {
        const env = { ...process.env };
        delete env.SWFRECOMP_CC;
        delete env.DJ_ORIGINAL_SWF;
        const r = spawnSync(process.execPath, [join(HERE, 'check-dj-swf-patch.mjs')],
            { cwd: REPO, env, encoding: 'utf8', timeout: 60000 });
        expect(r.stdout).toMatch(/^SKIP: SWFRECOMP_CC is not set/);
        expect(r.status).toBe(0);
    });
});

describe('provenance names the repository and the commit, never a path', () => {
    it('fixtures/seedling-ogmo-schema.json', () => {
        const fx = JSON.parse(readFileSync(
            join(REPO, 'frontend/modules/seedlingDemo/fixtures/seedling-ogmo-schema.json'), 'utf8'));
        expect(fx.provenance.git.repo).toBe(SEEDLING_REPO);
        expect(fx.provenance.git.commit).toMatch(/^[0-9a-f]{40}$/);
    });
});
