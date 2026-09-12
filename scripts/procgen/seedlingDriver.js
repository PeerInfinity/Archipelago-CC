/**
 * seedlingDriver — **WHERE A `seedling-*-win.py` DRIVER RUNS: real-GPU Windows
 * Chrome (`--win`) or this machine's headless Chromium (the default)** (slice
 * seedling-headless-H2, 2026-09-12; plan
 * `NewDocs/plans/seedling-headless-webgpu-plan.md` §11).
 *
 * ── ⛔⛔ WHY THE DRIVER IS SHARED AND NOT PORTED ──────────────────────────
 *
 * Four gates (`generated-set`, `save-stamp`, `vanilla-manifest`, `wasm-ship`)
 * observe the game ONLY through a Python Playwright driver that used to be
 * launchable only as `py.exe -3.12` on the Windows desktop. Porting that
 * observation protocol to JS would give it a second implementation, and the
 * Windows arm would then measure a different driver from the headless one. So
 * the SAME `.py` runs on both channels:
 *
 *   --win      staged under `C:\playwright\` and run by the Windows launcher
 *              the gate names — byte-for-byte what these gates always did
 *   headless   run in place by the repo venv's Linux python with `--headless
 *              --chromium-args=<json>`, staging its plan in a temp dir
 *
 * ⛔ THE HEADLESS SWITCHES COME FROM `headlessChromium.js` THROUGH ARGV, never
 * from a list in Python — H1's one-spelling invariant (census 28 -> 0).
 *
 * ⛓ WHY THE GATE PASSES `winPy` IN RATHER THAN THIS FILE HOLDING IT.
 * `gateRoster.js` classifies a gate as driving Windows by the ASSIGNMENT
 * `= '/mnt/c/Windows/py.exe'` in its OWN text (`WINDOWS_RE`, "the detector is
 * the assignment, not the mention"). Moving the literal here would silently
 * reclassify every consumer. And this is a `.js`, outside the roster's `.mjs`
 * populations, like `boxLock.js` and `headlessChromium.js`.
 *
 * ⛓ THE PYTHON: `SEEDLING_PYTHON` when set, else `<repo>/.venv/bin/python`,
 * which must carry `scripts/procgen/requirements-headless.txt` (Playwright
 * pinned to node's version, so both packages share one Chromium). A missing
 * interpreter is a refusal that names the install line, not a crash three
 * frames deep.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where the Windows channel stages a driver and its files, both spellings. */
export const WIN_STAGE_WSL = '/mnt/c/playwright';
export const WIN_STAGE_DOS = 'C:\\playwright';

/** The requirements file the headless channel's interpreter must carry. */
export const HEADLESS_REQUIREMENTS = 'scripts/procgen/requirements-headless.txt';

/** The Linux interpreter the headless channel runs a driver with. */
export function headlessPython({ env = process.env, repo = REPO } = {}) {
    if (env.SEEDLING_PYTHON) return env.SEEDLING_PYTHON;
    const venv = join(repo, '.venv', 'bin', 'python');
    if (!existsSync(venv)) {
        throw new Error(`seedlingDriver: the headless channel needs a Python with Playwright, and `
            + `${venv} does not exist. Create it (python3 -m venv .venv) and install `
            + `\`.venv/bin/pip install -r ${HEADLESS_REQUIREMENTS}\`, or set SEEDLING_PYTHON. `
            + '(`--win` drives real-GPU Windows Chrome instead.)');
    }
    return venv;
}

/**
 * The channel a driver runs on.
 *
 * @param {object} o
 * @param {boolean} o.win            `--win` was passed
 * @param {string}  o.winPy          the Windows launcher, as the GATE spells it
 * @param {string}  o.driver         absolute path of the `.py` driver
 * @param {string[]} o.chromiumArgs  the headless switches (`headlessChromium.js`)
 * @returns {{ name: 'win'|'headless', path: (f: string) => string,
 *   local: (f: string) => string, write: (f: string, s: string) => string,
 *   clear: (f: string) => void, read: (f: string) => string,
 *   run: (argv: string[], opts?: object) => string }}
 *   `path` is how the DRIVER spells a staged file; `local` is how this process
 *   reads it.
 */
export function driverChannel({ win, winPy, driver, chromiumArgs }) {
    if (!Array.isArray(chromiumArgs) || chromiumArgs.length === 0) {
        throw new Error('seedlingDriver: chromiumArgs must be the array headlessChromium.js '
            + 'exports — the headless channel spells no switches of its own');
    }
    const stage = win ? WIN_STAGE_WSL : mkdtempSync(join(tmpdir(), 'seedling-driver-'));
    const local = (f) => join(stage, f);
    const common = {
        name: win ? 'win' : 'headless',
        local,
        write: (f, s) => { writeFileSync(local(f), s); return local(f); },
        clear: (f) => { try { unlinkSync(local(f)); } catch { /* first run */ } },
        read: (f) => readFileSync(local(f), 'utf8'),
    };
    if (win) {
        mkdirSync(WIN_STAGE_WSL, { recursive: true });
        writeFileSync(join(WIN_STAGE_WSL, basename(driver)), readFileSync(driver));
        return {
            ...common,
            path: (f) => `${WIN_STAGE_DOS}\\${f}`,
            run: (argv, opts = {}) => execFileSync(winPy,
                ['-3.12', `${WIN_STAGE_DOS}\\${basename(driver)}`, ...argv],
                { cwd: WIN_STAGE_WSL, encoding: 'utf8', ...opts }),
        };
    }
    const python = headlessPython();
    return {
        ...common,
        path: local,
        run: (argv, opts = {}) => execFileSync(python,
            [driver, '--headless', `--chromium-args=${JSON.stringify(chromiumArgs)}`, ...argv],
            { cwd: stage, encoding: 'utf8', ...opts }),
    };
}
