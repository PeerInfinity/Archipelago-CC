/**
 * repoPython — the rows (slice seedling-headless-F2 task 1).
 *
 * ⛓ One row per rung of the ladder, each on a FAKE tree so the answer cannot
 * come from this machine's own venv:
 *   SEEDLING_PYTHON → $VIRTUAL_ENV/bin/python → <tree>/.venv/bin/python → PATH python3
 * and the refusal: the CHOSEN interpreter is asked, a present rung that cannot
 * import is not skipped, and the message names the tree, the ladder and the
 * module. ⛓ The probe rows run REAL executables (tiny shell scripts), so the
 * default `canImport` is exercised and not only an injected fake.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it } from 'vitest';

import { GENERATE_PY_REQUIRES, canImport, pythonLadder, resolvePython } from './repoPython.js';

/** A fake tree, optionally with `.venv/bin/python`, and a fake active venv. */
function fakeTree({ treeVenv = false, activeVenv = false } = {}) {
    const root = mkdtempSync(join(tmpdir(), 'repo-python-'));
    const repo = join(root, 'tree');
    mkdirSync(repo);
    const exe = (dir, exit) => {
        mkdirSync(dir, { recursive: true });
        const p = join(dir, 'python');
        writeFileSync(p, `#!/bin/sh\nexit ${exit}\n`);
        chmodSync(p, 0o755);
        return p;
    };
    const treePy = treeVenv ? exe(join(repo, '.venv', 'bin'), 0) : null;
    const venv = join(root, 'active-venv');
    const venvPy = activeVenv ? exe(join(venv, 'bin'), 0) : null;
    return { root, repo, venv, treePy, venvPy, exe };
}

const yes = () => true;

describe('pythonLadder — first present rung wins', () => {
    it('rung 1: SEEDLING_PYTHON beats an active venv and a tree venv', () => {
        const t = fakeTree({ treeVenv: true, activeVenv: true });
        const env = { SEEDLING_PYTHON: '/explicit/python', VIRTUAL_ENV: t.venv };
        expect(pythonLadder({ env, repo: t.repo }).chosen).toBe('/explicit/python');
        expect(resolvePython({ requires: ['m'], why: 'w', env, repo: t.repo, probe: yes }))
            .toBe('/explicit/python');
    });

    it('rung 2: $VIRTUAL_ENV/bin/python beats the tree venv — the worktree case', () => {
        const t = fakeTree({ treeVenv: true, activeVenv: true });
        expect(pythonLadder({ env: { VIRTUAL_ENV: t.venv }, repo: t.repo }).chosen).toBe(t.venvPy);
    });

    it('rung 2 absent: a VIRTUAL_ENV with no bin/python falls to the tree venv', () => {
        const t = fakeTree({ treeVenv: true });
        const { chosen, tried } = pythonLadder({ env: { VIRTUAL_ENV: t.venv }, repo: t.repo });
        expect(chosen).toBe(t.treePy);
        expect(tried[1].present).toBe(false);
    });

    it('rung 3: <tree>/.venv/bin/python when no env names one', () => {
        const t = fakeTree({ treeVenv: true });
        expect(pythonLadder({ env: {}, repo: t.repo }).chosen).toBe(t.treePy);
    });

    it('rung 4: PATH python3 when nothing else is present', () => {
        const t = fakeTree();
        const { chosen, tried } = pythonLadder({ env: {}, repo: t.repo });
        expect(chosen).toBe('python3');
        expect(tried.map((r) => r.present)).toEqual([false, false, false, true]);
    });
});

describe('resolvePython — the chosen interpreter is ASKED', () => {
    it('the default probe runs the interpreter: exit 0 admits, exit 1 refuses', () => {
        const t = fakeTree({ activeVenv: true });
        const bad = t.exe(join(t.root, 'bad'), 1);
        expect(canImport(t.venvPy, 'anything', { cwd: t.repo })).toBe(true);
        expect(canImport(bad, 'anything', { cwd: t.repo })).toBe(false);
        expect(resolvePython({ requires: ['playwright'], why: 'w',
            env: { VIRTUAL_ENV: t.venv }, repo: t.repo })).toBe(t.venvPy);
    });

    it('a present rung that cannot import REFUSES — it is not skipped for a later rung', () => {
        const t = fakeTree({ treeVenv: true });
        const bad = t.exe(join(t.root, 'bad'), 1);
        const seen = [];
        const probe = (py, m) => { seen.push(py); return canImport(py, m); };
        let msg = '';
        try {
            resolvePython({ requires: ['playwright'], why: 'the headless channel',
                install: 'pip install it', env: { SEEDLING_PYTHON: bad }, repo: t.repo, probe });
        } catch (e) { msg = e.message; }
        expect(seen).toEqual([bad]);
        expect(msg).toMatch(/^REFUSED: the headless channel needs a Python that can `import playwright`/);
        expect(msg).toContain(`tree ${t.repo}`);
        for (const rung of ['SEEDLING_PYTHON', '$VIRTUAL_ENV/bin/python', '<tree>/.venv/bin/python',
            'PATH python3']) expect(msg).toContain(rung);
        expect(msg).toContain(t.treePy);
        expect(msg).toContain('pip install it');
    });

    it('names the FIRST module the interpreter cannot import', () => {
        const t = fakeTree();
        expect(() => resolvePython({ requires: ['ok', 'nope'], why: 'w', env: {}, repo: t.repo,
            probe: (_py, m) => m === 'ok' })).toThrow(/`import nope`/);
    });
});

/**
 * ⛓ F2 task 4 — the roundtrip gates' spelling, on a REAL child process: a
 * venv whose python cannot import `Utils` is refused by name with exit 2 and
 * NO PASS line, never a silent `python3` that dies after 8 of them.
 */
describe('generatePythonOrExit — the Generate.py gates', () => {
    const HELPER = pathToFileURL(join(import.meta.dirname, 'repoPython.js')).href;
    const child = (env) => {
        const dir = mkdtempSync(join(tmpdir(), 'gen-python-'));
        const f = join(dir, 'check-fixture-roundtrip.mjs');
        writeFileSync(f, `import { generatePythonOrExit } from '${HELPER}';\n`
            + "const py = generatePythonOrExit('check-fixture-roundtrip.mjs');\n"
            + "console.log(`PASS: resolved ${py}`);\n");
        return spawnSync(process.execPath, [f], { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
    };

    it('probes the module Generate.py itself needs first', () => {
        expect(GENERATE_PY_REQUIRES).toEqual(['Utils']);
    });

    it('an active venv that cannot import Utils: REFUSED by name, exit 2, no PASS line', () => {
        const t = fakeTree();
        const bad = t.exe(join(t.venv, 'bin'), 1);
        const r = child({ VIRTUAL_ENV: t.venv });
        expect(r.status).toBe(2);
        expect(r.stdout).toMatch(/^REFUSED: check-fixture-roundtrip\.mjs: Generate\.py \/ world_generator needs a Python that can `import Utils`/);
        expect(r.stdout).toContain(bad);
        expect(r.stdout).not.toMatch(/^PASS:/m);
    });

    it('an active venv that can: the gate runs on it', () => {
        const t = fakeTree({ activeVenv: true });
        const r = child({ VIRTUAL_ENV: t.venv });
        expect(r.status).toBe(0);
        expect(r.stdout.trim()).toBe(`PASS: resolved ${t.venvPy}`);
    });
});

/**
 * ⛓ WT1 task 1 — the CLI face `new-worktree.sh` asks. The refusal row sets
 * rung 1 to `/bin/false`: present, cannot import, and never skipped — a
 * deterministic refusal that touches no real venv.
 */
describe('repoPython.js --generate — the ladder from a shell', () => {
    const CLI = join(import.meta.dirname, 'repoPython.js');
    const cli = (args, env) => spawnSync(process.execPath, [CLI, ...args],
        { encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });

    it('prints the chosen path and nothing else, exit 0', () => {
        const t = fakeTree({ activeVenv: true });
        const r = cli(['--generate'], { SEEDLING_PYTHON: t.venvPy });
        expect(r.status).toBe(0);
        expect(r.stdout).toBe(`${t.venvPy}\n`);
    });

    it('SEEDLING_PYTHON=/bin/false: exit 2, the refusal with the whole ladder', () => {
        const r = cli(['--generate'], { SEEDLING_PYTHON: '/bin/false' });
        expect(r.status).toBe(2);
        expect(r.stdout).toMatch(/^REFUSED: repoPython\.js --generate: Generate\.py \/ world_generator needs a Python that can `import Utils`.*: \/bin\/false$/m);
        for (const rung of ['SEEDLING_PYTHON', '$VIRTUAL_ENV/bin/python', '<tree>/.venv/bin/python',
            'PATH python3']) expect(r.stdout).toContain(rung);
    });

    it('anything but --generate: usage on stderr, exit 1, no path printed', () => {
        for (const args of [[], ['--nope'], ['--generate', 'extra']]) {
            const r = cli(args, {});
            expect(r.status).toBe(1);
            expect(r.stdout).toBe('');
            expect(r.stderr).toMatch(/usage: node scripts\/procgen\/repoPython\.js --generate/);
        }
    });
});

describe('one spelling — no gate carries its own venv-or-python3 fallback', () => {
    it('no check-*.mjs resolves `.venv/bin/python` by hand', async () => {
        const { readdirSync, readFileSync } = await import('node:fs');
        const here = import.meta.dirname;
        const own = readdirSync(here).filter((f) => /^check-.*\.mjs$/.test(f))
            .filter((f) => /existsSync\([^)]*\.venv\/bin\/python/.test(readFileSync(join(here, f), 'utf8')));
        expect(own).toEqual([]);
        const users = readdirSync(here).filter((f) => /^check-.*\.mjs$/.test(f))
            .filter((f) => readFileSync(join(here, f), 'utf8').includes('generatePythonOrExit('));
        expect(users.length).toBeGreaterThan(0);
    });
});
