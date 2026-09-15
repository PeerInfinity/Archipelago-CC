/**
 * seedlingSource — **THE ROWS: A SEEDLING-READING INSTRUMENT IS TOLD WHERE THE
 * FORK IS, OR IT SAYS SO BY NAME** (slice seedling-headless-E1).
 *
 * ⛔ The spawned rows run with the real HOME on purpose: on a machine where a
 * clone sits at the old layout default, an instrument that still guessed it
 * would FIND it and exit 0 — so these rows red on exactly the machine where a
 * layout fallback would otherwise hide.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    SEEDLING_REPO, SEEDLING_SRC_ENV, seedlingSource, seedlingSourceRefusal,
} from './seedlingSource.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** The environment with every source-naming variable removed. */
function unnamedEnv() {
    const env = { ...process.env };
    delete env[SEEDLING_SRC_ENV];
    delete env.SWFRECOMP_CC;
    delete env.DJ_ORIGINAL_SWF;
    return env;
}

function run(cmd, args) {
    const r = spawnSync(cmd, args, { cwd: REPO, env: unnamedEnv(), encoding: 'utf8', timeout: 60000 });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

describe('seedlingSource: the flag, then SEEDLING_SRC, then nothing', () => {
    it('the flag wins over the variable, and the variable is used without one', () => {
        expect(seedlingSource('/a', { [SEEDLING_SRC_ENV]: '/b' })).toBe(resolve('/a'));
        expect(seedlingSource(null, { [SEEDLING_SRC_ENV]: '/b' })).toBe(resolve('/b'));
    });

    it('neither named is null — there is no layout fallback', () => {
        expect(seedlingSource(null, {})).toBeNull();
        expect(seedlingSource('', { [SEEDLING_SRC_ENV]: '' })).toBeNull();
    });
});

describe('⛔ an instrument with no checkout named REFUSES by name, exit 2', () => {
    const NODE_TOOLS = [
        ['extract-seedling-masks.mjs', ['--check']],
        ['extract-seedling-damage-sites.mjs', ['--check']],
        ['recon-seedling-r5.mjs', ['--kill-locks']],
    ];
    for (const [tool, args] of NODE_TOOLS) {
        it(`${tool} ${args.join(' ')}`, () => {
            const r = run(process.execPath, [join(HERE, tool), ...args]);
            expect(r.stderr.trim()).toBe(seedlingSourceRefusal(tool));
            expect(r.status).toBe(2);
        });
    }

    const PY_TOOLS = ['extract-seedling-ogmo-schema.py', 'extract-seedling-vanilla-set.py'];
    for (const tool of PY_TOOLS) {
        it(`${tool} --stdout (the same words, spelled in Python)`, () => {
            const r = run('python3', [join(HERE, tool), '--stdout']);
            expect(r.stderr.trim()).toBe(seedlingSourceRefusal(tool, '--seedling'));
            expect(r.status).toBe(2);
        });
    }
});

describe('a probe whose checkout is OPTIONAL skips, and the skip names the variable', () => {
    it('probe-seedling-ctor-args.mjs', () => {
        const r = run(process.execPath, [join(HERE, 'probe-seedling-ctor-args.mjs')]);
        expect(r.stdout).toMatch(/^SKIP: SEEDLING_SRC is not set/);
        expect(r.status).toBe(0);
    });

    it('check-dj-swf-patch.mjs (SWFRECOMP_CC, the recompiler checkout)', () => {
        const r = run(process.execPath, [join(HERE, 'check-dj-swf-patch.mjs')]);
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
