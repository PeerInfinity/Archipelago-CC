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
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { canImport, pythonLadder, resolvePython } from './repoPython.js';

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
