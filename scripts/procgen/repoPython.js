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
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** `python -c "import <module>"` from `cwd` — true when it exits 0. */
export function canImport(python, module, { cwd = REPO } = {}) {
    const r = spawnSync(python, ['-c', `import ${module}`], { cwd, stdio: 'ignore' });
    return r.status === 0;
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
 * The Python that can `import` every one of `requires`, or a thrown refusal
 * naming the tree, the ladder and the module that failed.
 *
 * @param {object} o
 * @param {string[]} o.requires   modules the caller's work imports
 * @param {string}   o.why        what the caller needs them for (one clause)
 * @param {string}   [o.install]  the line that fixes it
 * @param {Function} [o.probe]    `(python, module, {cwd}) => boolean` (tests)
 */
export function resolvePython({ requires, why, install = null, env = process.env, repo = REPO,
    probe = canImport }) {
    const { chosen, tried } = pythonLadder({ env, repo });
    const missing = requires.find((m) => !probe(chosen, m, { cwd: repo }));
    if (missing === undefined) return chosen;
    const at = tried.findIndex((t) => t.present);
    const ladder = tried.map((t, i) => `      ${t.present ? (i === at ? '→' : '·') : '✗'} `
        + `${t.rung.padEnd(24)} ${t.python ?? '(unset)'}${t.present ? '' : ' — absent'}`).join('\n');
    throw new Error(`REFUSED: ${why} needs a Python that can \`import ${missing}\`, and the one `
        + `chosen for tree ${repo} cannot: ${chosen}\n`
        + `   the ladder (first present wins; a present rung that cannot import is NOT skipped):\n`
        + `${ladder}\n`
        + `   ${install ?? 'activate a venv carrying it, or set SEEDLING_PYTHON'}`);
}
