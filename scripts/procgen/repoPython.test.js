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
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { describe, expect, it, vi } from 'vitest';

import { GENERATE_PY_REQUIRES, canImport, generatePythonOrExit, pinnedVersion, pythonLadder, requirementLines,
    resolvePython, venvActivationHint, versionOf } from './repoPython.js';
import { headlessPython } from './seedlingDriver.js';

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
 * ⛓ C1 task 1 — **A PIN IS ASKED TOO** (trap 1354: an import probe cannot see
 * a version). Each row writes its own requirements file into a fake tree and
 * injects the interpreter's answer, so no row reads this machine's venv or
 * the real pin: EQUAL admits; older, newer, no distribution metadata, a file
 * that does not pin the name, and a file that cannot be read each refuse by
 * name.
 */
describe('resolvePython — pins: the chosen interpreter\'s version must EQUAL the file\'s', () => {
    const pinned = (text) => {
        const t = fakeTree({ activeVenv: true });
        mkdirSync(join(t.repo, 'reqs'));
        if (text !== null) writeFileSync(join(t.repo, 'reqs', 'r.txt'), text);
        return t;
    };
    const FILE = 'reqs/r.txt';
    const ask = (t, have) => {
        try {
            return resolvePython({ requires: ['pkg'], pins: [{ dist: 'pkg', file: FILE }], why: 'the pin row',
                env: { VIRTUAL_ENV: t.venv }, repo: t.repo, probe: yes, version: () => have });
        } catch (e) { return e; }
    };
    const REQS = '# a docblock\n\nother==9.0\npkg==1.56.0\n';

    it('equal: the interpreter is chosen', () => {
        const t = pinned(REQS);
        expect(ask(t, '1.56.0')).toBe(t.venvPy);
    });

    for (const [label, have] of [['older', '1.55.0'], ['newer', '1.57.0']]) {
        it(`${label}: REFUSED, naming the interpreter, both versions, the file and the install line`, () => {
            const t = pinned(REQS);
            const e = ask(t, have);
            expect(e).toBeInstanceOf(Error);
            const path = join(t.repo, FILE);
            expect(e.message).toMatch(/^REFUSED: the pin row needs a Python that carries pkg==1\.56\.0/);
            expect(e.message).toContain(`${t.venvPy} has pkg ${have}, the pin is 1.56.0`);
            expect(e.message).toContain(`\`${t.venvPy} -m pip install -r ${path}\``);
        });
    }

    it('importable but no distribution metadata: REFUSED by name', () => {
        const e = ask(pinned(REQS), null);
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toContain('has pkg <no distribution metadata>, the pin is 1.56.0');
    });

    it('a file that does not pin the name, or cannot be read: REFUSED — nothing was compared', () => {
        const unpinned = ask(pinned('other==9.0\npkg>=1.0\n'), '1.56.0');
        expect(unpinned).toBeInstanceOf(Error);
        expect(unpinned.message).toMatch(/does not pin `pkg==<version>` — nothing was compared/);
        const absent = ask(pinned(null), '1.56.0');
        expect(absent).toBeInstanceOf(Error);
        expect(absent.message).toMatch(/the pin file cannot be read \(ENOENT\) — nothing was compared/);
    });

    it('the import is asked FIRST: an interpreter that cannot import is refused for the import, not the pin', () => {
        const t = pinned(REQS);
        const seen = [];
        expect(() => resolvePython({ requires: ['pkg'], pins: [{ dist: 'pkg', file: FILE }], why: 'w',
            env: { VIRTUAL_ENV: t.venv }, repo: t.repo, probe: () => false,
            version: () => { seen.push('version'); return '1.56.0'; } })).toThrow(/`import pkg`/);
        expect(seen).toEqual([]);
    });

    it('the default versionOf runs the interpreter: its printed version, or null when it exits non-zero', () => {
        const t = fakeTree();
        mkdirSync(join(t.root, 'v'));
        const py = join(t.root, 'v', 'python');
        writeFileSync(py, '#!/bin/sh\necho "$3-from-$2"\n');
        chmodSync(py, 0o755);
        expect(versionOf(py, 'pkg', { cwd: t.repo })).toMatch(/^pkg-from-import importlib\.metadata/);
        expect(versionOf(t.exe(join(t.root, 'bad'), 1), 'pkg', { cwd: t.repo })).toBe(null);
    });

    it('the one parse: requirement lines, and the version a name pins', () => {
        const lines = requirementLines(REQS);
        expect(lines).toEqual(['other==9.0', 'pkg==1.56.0']);
        expect(pinnedVersion(lines, 'pkg')).toBe('1.56.0');
        expect(pinnedVersion(lines, 'pk')).toBe(null);
        expect(pinnedVersion(['pkg>=1'], 'pkg')).toBe(null);
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

/**
 * ⛓ C1 task 2 — **THE HINT NAMES THE VENV THAT EXISTS.** A worktree has no
 * `.venv`; its refusal must name the PRIMARY's. The layout rows inject the
 * common git dir; one row builds a real repo and a real `git worktree add`, so
 * the default spawn is exercised and the `--git-common-dir` spelling (not
 * `--git-dir`, which differs in a worktree) is what is asked.
 */
describe('venvActivationHint — the primary\'s venv, named from a worktree', () => {
    const PRIMARY_TEXT = 'activate the tree\'s venv (`source .venv/bin/activate`), or set SEEDLING_PYTHON';

    it('primary layout (the common dir is <tree>/.git): the tree\'s own venv', () => {
        const t = fakeTree();
        expect(venvActivationHint(t.repo, { commonDir: join(t.repo, '.git') })).toBe(PRIMARY_TEXT);
        /* a symlinked spelling of the same tree is still the primary */
        const link = join(t.root, 'link');
        symlinkSync(t.repo, link);
        expect(venvActivationHint(link, { commonDir: join(t.repo, '.git') })).toBe(PRIMARY_TEXT);
    });

    it('worktree layout (the common dir is <primary>/.git): source <primary>/.venv/bin/activate', () => {
        const t = fakeTree();
        const primary = join(t.root, 'primary');
        mkdirSync(join(primary, '.git'), { recursive: true });
        const hint = venvActivationHint(t.repo, { commonDir: join(primary, '.git') });
        expect(hint).toContain(`source ${primary}/.venv/bin/activate`);
        expect(hint).not.toContain('source .venv/bin/activate');
        expect(hint).toMatch(/or set SEEDLING_PYTHON$/);
    });

    it('asked of git: a real primary and a real worktree (and a tree git cannot answer for)', () => {
        const root = mkdtempSync(join(tmpdir(), 'venv-hint-'));
        const primary = join(root, 'primary');
        const wt = join(root, 'wt');
        const g = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=r', '-c', 'user.email=r@example.invalid',
            ...args], { cwd, stdio: 'ignore' });
        mkdirSync(primary);
        g(primary, 'init', '-q');
        g(primary, 'commit', '-q', '--allow-empty', '-m', 'r');
        g(primary, 'worktree', 'add', '-q', wt);
        mkdirSync(join(wt, 'sub'));
        mkdirSync(join(primary, 'sub'));
        expect(venvActivationHint(primary)).toBe(PRIMARY_TEXT);
        /* from a subdirectory git's default spelling is RELATIVE (`../.git`) */
        expect(venvActivationHint(join(primary, 'sub'))).toBe(PRIMARY_TEXT);
        expect(venvActivationHint(join(wt, 'sub'))).toContain(`source ${primary}/.venv/bin/activate`);
        expect(venvActivationHint(wt)).toContain(`source ${primary}/.venv/bin/activate`);
        expect(venvActivationHint(join(root, 'nowhere'))).toBe(PRIMARY_TEXT);
    });

    it('both refusals carry it: generatePythonOrExit and headlessPython, in a worktree layout', () => {
        const t = fakeTree();
        const primary = join(t.root, 'primary');
        const commonDir = join(primary, '.git');
        const want = `source ${primary}/.venv/bin/activate`;
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});
        const exit = vi.spyOn(process, 'exit').mockImplementation((c) => { throw new Error(`exit ${c}`); });
        try {
            expect(() => generatePythonOrExit('g.mjs', { env: {}, repo: t.repo, probe: () => false, commonDir }))
                .toThrow('exit 2');
            expect(log.mock.calls.flat().join('\n')).toContain(want);
        } finally { log.mockRestore(); exit.mockRestore(); }
        expect(() => headlessPython({ env: {}, repo: t.repo, probe: () => false, commonDir })).toThrow(want);
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

    it('C1: the venv activation text is spelled ONCE — venvActivationHint — in repoPython.js and seedlingDriver.js', () => {
        const here = import.meta.dirname;
        const spelling = /source [^\s`]*\.venv\/bin\/activate|venv \.venv/g;
        const lib = readFileSync(join(here, 'repoPython.js'), 'utf8');
        const fn = lib.indexOf('export function venvActivationHint(');
        const end = lib.indexOf('\n}\n', fn);
        /* the helper's two branches spell it; its own docblock may quote them */
        expect(lib.slice(fn, end).match(spelling)?.length).toBe(2);
        const start = lib.lastIndexOf('/**', fn);
        const outside = {
            'repoPython.js': (lib.slice(0, start) + lib.slice(end)).match(spelling) ?? [],
            'seedlingDriver.js': readFileSync(join(here, 'seedlingDriver.js'), 'utf8').match(spelling) ?? [],
        };
        expect(outside).toEqual({ 'repoPython.js': [], 'seedlingDriver.js': [] });
    });
});
