/**
 * repoPython — **WHICH PYTHON A GATE RUNS, AND THE REFUSAL WHEN IT CANNOT DO
 * THE JOB** (slice seedling-headless-F2, 2026-09-13; plan
 * `NewDocs/plans/seedling-headless-webgpu-plan.md` §18).
 *
 * ── ⛔⛔ THE TWO DEFECTS THIS REPLACES ─────────────────────────────────────
 *
 *   1. `seedlingDriver.js` resolved `SEEDLING_PYTHON`, else `<tree>/.venv/bin/
 *      python`, else refused. A WORKTREE has no `.venv`, but its shell does
 *      carry one: the launcher activates the primary tree's venv, so
 *      `$VIRTUAL_ENV` was set and ignored. Measured: the sidecars planner's
 *      write from `wt-b6` read `gate: seedling-save-stamp` and
 *      `-vanilla-manifest` as EXIT 1 in 0.1 s.
 *   2. Six roundtrip gates spelled `.venv/bin/python` if it exists, else a
 *      silent `python3`. In a venv-less worktree that `python3` has no
 *      Archipelago requirements, so `Generate.py` died on `pathspec` AFTER 8
 *      PASS lines, with exit 1 and no total (F1 §16.1.3, reproduced).
 *
 * ⛓ ONE LADDER, FIRST PRESENT WINS:
 *   `SEEDLING_PYTHON` → `$VIRTUAL_ENV/bin/python` → `<tree>/.venv/bin/python`
 *   → `python3` on PATH.
 * ⛔ THE CHOSEN INTERPRETER IS THEN ASKED, NOT ASSUMED. It must `import` the
 * module the caller needs, or the resolution REFUSES by name: the tree, every
 * rung tried and what each held. ⛔ NO FALL-THROUGH past a present rung that
 * cannot import — an explicit `SEEDLING_PYTHON` or an active venv that is wrong
 * is a fact the reader must see, not a rung to skip quietly.
 *
 * ⛓ `.js`, not `.mjs`: outside the gate roster's populations, like
 * `seedlingDriver.js` and `headlessChromium.js`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `python -c "import <module>"` from `cwd` — true when it exits 0. */
export function canImport(python, module, { cwd = REPO } = {}) {
    const r = spawnSync(python, ['-c', `import ${module}`], { cwd, stdio: 'ignore' });
    return r.status === 0;
}

/**
 * `importlib.metadata.version(<dist>)` as the interpreter reports it, or
 * `null` when it cannot (`PackageNotFoundError`: importable, no distribution).
 */
export function versionOf(python, dist, { cwd = REPO } = {}) {
    const r = spawnSync(python, ['-c',
        'import importlib.metadata as m, sys; print(m.version(sys.argv[1]))', dist],
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

/**
 * ⛓ C1 — **THE ONE PARSE OF A REQUIREMENTS FILE**: its requirement lines,
 * trimmed, blank lines and `#` comments dropped. `headlessChromium.test.js`
 * pins the node half with this same parse.
 */
export function requirementLines(text) {
    return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

/** The version `<dist>==<version>` declares in `lines`, or `null` when none does. */
export function pinnedVersion(lines, dist) {
    const line = lines.find((l) => l.startsWith(`${dist}==`));
    return line ? line.slice(dist.length + 2).trim() || null : null;
}

/**
 * The interpreter ladder, rung by rung, WITHOUT asking any of them anything.
 * @returns {{ chosen: string|null, tried: { rung: string, python: string|null, present: boolean }[] }}
 */
export function pythonLadder({ env = process.env, repo = REPO } = {}) {
    const venvPy = env.VIRTUAL_ENV ? join(env.VIRTUAL_ENV, 'bin', 'python') : null;
    const treePy = join(repo, '.venv', 'bin', 'python');
    const tried = [
        { rung: 'SEEDLING_PYTHON', python: env.SEEDLING_PYTHON || null,
            present: Boolean(env.SEEDLING_PYTHON) },
        { rung: '$VIRTUAL_ENV/bin/python', python: venvPy,
            present: Boolean(venvPy) && existsSync(venvPy) },
        { rung: '<tree>/.venv/bin/python', python: treePy, present: existsSync(treePy) },
        { rung: 'PATH python3', python: 'python3', present: true },
    ];
    return { chosen: tried.find((t) => t.present).python, tried };
}

/**
 * The Python that can `import` every one of `requires` AND carries exactly
 * the version each of `pins` declares, or a thrown refusal naming the tree,
 * the ladder and what failed.
 *
 * ⛔ An import probe alone cannot see a version: a user-site package of
 * another build imports fine (trap 1354). So a pin is checked AFTER the
 * import, against the version its requirements FILE declares — never a
 * literal here. A file that cannot be read, or that does not pin the name, is
 * itself a refusal: an unchecked pin is not a passed one.
 *
 * @param {object} o
 * @param {string[]} o.requires   modules the caller's work imports
 * @param {{dist: string, file: string}[]} [o.pins]  distributions whose
 *                                version must EQUAL `file`'s `dist==version`
 *                                (`file` relative to the tree)
 * @param {string}   o.why        what the caller needs them for (one clause)
 * @param {string}   [o.install]  the line that fixes it
 * @param {Function} [o.probe]    `(python, module, {cwd}) => boolean` (tests)
 * @param {Function} [o.version]  `(python, dist, {cwd}) => string|null` (tests)
 */
export function resolvePython({ requires, pins = [], why, install = null, env = process.env, repo = REPO,
    probe = canImport, version = versionOf }) {
    const { chosen, tried } = pythonLadder({ env, repo });
    const at = tried.findIndex((t) => t.present);
    const ladder = tried.map((t, i) => `      ${t.present ? (i === at ? '→' : '·') : '✗'} `
        + `${t.rung.padEnd(24)} ${t.python ?? '(unset)'}${t.present ? '' : ' — absent'}`).join('\n');
    const refuse = (needs, fix) => new Error(`REFUSED: ${why} needs a Python that ${needs}, and the one `
        + `chosen for tree ${repo} cannot: ${chosen}\n`
        + `   the ladder (first present wins; a present rung that fails is NOT skipped):\n`
        + `${ladder}\n`
        + `   ${fix}`);
    const missing = requires.find((m) => !probe(chosen, m, { cwd: repo }));
    if (missing !== undefined) {
        throw refuse(`can \`import ${missing}\``, install ?? 'activate a venv carrying it, or set SEEDLING_PYTHON');
    }
    for (const { dist, file } of pins) {
        const path = resolve(repo, file);
        const reinstall = `\`${chosen} -m pip install -r ${path}\``;
        let lines;
        try { lines = requirementLines(readFileSync(path, 'utf8')); } catch (e) {
            throw refuse(`carries the ${dist} pinned in ${path}`,
                `the pin file cannot be read (${e.code ?? e.message}) — nothing was compared`);
        }
        const pin = pinnedVersion(lines, dist);
        if (pin === null) {
            throw refuse(`carries the ${dist} pinned in ${path}`,
                `${path} does not pin \`${dist}==<version>\` — nothing was compared`);
        }
        const have = version(chosen, dist, { cwd: repo });
        if (have !== pin) {
            throw refuse(`carries ${dist}==${pin} (pinned in ${path})`,
                `${chosen} has ${dist} ${have === null ? '<no distribution metadata>' : have}, `
                + `the pin is ${pin}: ${reinstall}`);
        }
    }
    return chosen;
}

/**
 * ⛓ F2 task 4 — **THE PYTHON A `Generate.py` / `world_generator` GATE RUNS**,
 * or a refusal printed by name and exit 2 (the roster's refusal code: nothing
 * was measured) — BEFORE the gate prints its first PASS line.
 *
 * ⛓ `Utils` is the probe because it is `Generate.py`'s own first import that
 * needs `requirements.txt` (`Utils.py` imports `pathspec`, the exact module the
 * venv-less worktree died on, F1 §16.1.3). One spelling for the six roundtrip
 * gates; before F2 each carried `.venv/bin/python if present, else python3`.
 */
export const GENERATE_PY_REQUIRES = Object.freeze(['Utils']);

export function generatePythonOrExit(gate, { env = process.env, repo = REPO, probe = canImport } = {}) {
    try {
        return resolvePython({ requires: [...GENERATE_PY_REQUIRES], env, repo, probe,
            why: `${gate}: Generate.py / world_generator`,
            install: 'activate the tree\'s venv (`source .venv/bin/activate`, from `requirements.txt`), '
                + 'or set SEEDLING_PYTHON to a Python that carries Archipelago\'s requirements' });
    } catch (e) {
        console.log(e.message);
        process.exit(2);
    }
}

/**
 * ⛓ WT1 task 1 — **THE LADDER, ASKED FROM A SHELL**: `node scripts/procgen/
 * repoPython.js --generate` prints the Python `generatePythonOrExit` chooses
 * for THIS file's tree (exit 0), or its refusal with the ladder (exit 2).
 * `new-worktree.sh` asks here instead of re-spelling the ladder in bash — a
 * second spelling was the defect F2 replaced.
 */
export const CLI_USAGE = 'usage: node scripts/procgen/repoPython.js --generate';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    if (args.length !== 1 || args[0] !== '--generate') {
        console.error(CLI_USAGE);
        process.exit(1);
    }
    console.log(generatePythonOrExit('repoPython.js --generate'));
}
