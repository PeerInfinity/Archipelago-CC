/**
 * argvHelp — **`--help` PRINTS AND EXITS, AND IT DRIVES NOTHING** (R9 slice
 * P4a, ⚖ ruling 47b (4); user, 2026-08-24: *"Should we update the script so
 * that that command behaves as expected?"*).
 *
 * ── ⛔⛔ WHAT `--help` DID BEFORE ─────────────────────────────────────
 *
 * It ran the instrument. Measured at `1097be9e6` by spawning `--help` on all
 * 260 files in this directory, each in a child with a temp `XDG_CACHE_HOME`
 * and a `git status --porcelain` observer: one instrument WROTE A 148 KB
 * FILE NAMED `--help` into the repository root (argv[2] read as an output
 * path), one REWROTE A TRACKED SOURCE FILE, and dozens launched browsers or
 * spawned producers. `scripts/procgen/help.mjs` exists because for some of
 * them no in-file guard can prevent that.
 *
 * ── ⛓ WHAT IT PRINTS, AND WHY NONE OF IT IS TYPED ────────────────────
 *
 * The file's own one-liner and `Run:` block, then the flags the INSTRUMENTS
 * INDEX derives for that file — `argvScan.js`, the same scanner the generated
 * reference table is built from (⚖ ruling 38 (6): read out of the file, never
 * a hand list; ⚖ ruling 17). A help text that could disagree with the
 * published table would be a third place to keep the same fact.
 *
 * ⛓ Inherited flags are named WITH THEIR PARSE SITE — `--wait-for-box=<sec>
 * (inherited from boxLock.js)` — because "where it is parsed" and "what this
 * accepts" are two different true statements and the table now carries both
 * (§48.13 item 2).
 *
 * ── ⚠⚠ THE HOISTING BOUND, STATED WHERE THE CALLER WILL READ IT ──────
 *
 * ESM imports are HOISTED. Calling `argvHelp(import.meta.url)` as the first
 * statement of a file's body preempts THAT FILE's module-scope work and
 * nothing else: if the side effect lives in a module the file imports (the
 * campaign producer solving on import — trap 584; `rehearsalTree.js` parsing
 * argv at module scope; `reference/sources.mjs` dynamically importing
 * eighteen frontend modules), the work is already done by the time this runs.
 * Those files are named by `check-procgen-help.mjs`, which measures the
 * property instead of assuming it.
 */

import { readFileSync, realpathSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    argvHelpersIn, docblockOf, documentedFlagsIn, flagsIn, headerOf, inheritedFlagsIn,
} from './argvScan.js';
import { firstSentence } from './reference/lib.mjs';

/**
 * ⛓⛓ THE TOKEN IS SPELLED AS A LITERAL IN THE CALL, and that is not an
 * oversight about the constant beside it. The instruments index finds a flag
 * by matching `includes('--x')` in a file's source, so `argv.includes(HELP_
 * FLAG)` would parse this module as reading NO flag and the 260 importers
 * would inherit nothing — the same law `dashMode.js` states for `--dash` at
 * 12i, one module over. The constant is for readers; the literal is for the
 * scan, and they are checked against each other in `argvHelp.test.js`.
 */
export const HELP_FLAG = '--help';

/** Whether an argv asks for help. */
export const wantsHelp = (argv = process.argv) => argv.includes('--help');

/**
 * The help text for one instrument, derived from its source.
 *
 * ⛔ IT TAKES A PATH, NOT A MODULE. Nothing here imports the file it
 * describes, which is what lets `help.mjs` answer for an instrument whose
 * module scope cannot be preempted.
 *
 * @param {string} file  absolute path to a `scripts/procgen/*.mjs`
 * @returns {string}
 */
export function helpText(file) {
    let text;
    try { text = readFileSync(file, 'utf8'); } catch {
        return `${basename(file)} — no such instrument in scripts/procgen/`;
    }
    const doc = docblockOf(headerOf(text));
    const lines = [];
    /* ⛓ the index's OWN one-liner rule, imported rather than re-cut. */
    const oneLiner = doc ? firstSentence(doc.text) : null;
    lines.push(`${basename(file)}${oneLiner ? ` — ${oneLiner}` : ''}`);

    const run = doc
        ? (/(?:^|\n)\s*(?:Run|Usage|USAGE|RUN):([\s\S]*?)(?:\n\s*\n|$)/.exec(doc.text) ?? [])[1]
        : null;
    if (run && run.trim()) {
        lines.push('', 'Run:', ...run.split('\n').map((l) => l.replace(/^\s*/, '  ').trimEnd())
            .filter((l) => l.trim()));
    }

    const own = flagsIn(text, { file });
    const inherited = inheritedFlagsIn(text, { file });
    const documented = new Set(documentedFlagsIn(doc ? doc.text : ''));
    if (own.length || inherited.length) {
        lines.push('', 'Flags (derived from this file by the instruments index — never typed):');
        for (const f of own) {
            lines.push(`  --${f.name}   [${f.how.join(', ')}]`
                + `${documented.has(f.name) ? '' : '   ⚠ undocumented'}`);
        }
        for (const f of inherited) lines.push(`  --${f.name}   (inherited from ${f.from})`);
    } else {
        lines.push('', 'Flags: none — this instrument reads no argv of its own.');
    }
    const helpers = argvHelpersIn(text, { file });
    if (helpers.length) lines.push('', `argv helpers found in this file: ${helpers.join(', ')}`);
    lines.push('', '⛓ `--help` prints this and exits 0. It drives nothing — '
        + '`check-procgen-help.mjs` is the gate that says so.');
    return lines.join('\n');
}

/**
 * ⛓⛓⛓ **ONLY THE FILE THAT WAS RUN ANSWERS — AND THE GATE CAUGHT THIS THE
 * HARD WAY.** Every instrument in this directory carries the guard, and ESM
 * imports are HOISTED, so when one instrument imports another the DEPENDENCY's
 * body runs first. Measured: `check-preset-bundle-load.mjs --help` printed
 * **`loadJSZipNode.mjs`'s** help text and exited 0 — a true help page about
 * the wrong file, from a call that never reached the file the reader typed.
 * Nothing but the gate's byte-exact *"stdout IS the derived help text FOR THIS
 * FILE"* assertion could have seen it; every other observer was satisfied.
 *
 * ⇒ the guard fires only when this module IS the entry point. `realpathSync`
 * on both sides because a worktree, a symlink and a relative `argv[1]` are all
 * spellings of the same file.
 */
export function isEntryPoint(metaUrl, argv = process.argv) {
    const real = (p) => { try { return realpathSync(p); } catch { return p; } };
    if (!argv[1]) return false;
    return real(fileURLToPath(metaUrl)) === real(resolve(argv[1]));
}

/**
 * ⛓ CALL THIS AS THE FIRST STATEMENT OF AN INSTRUMENT'S BODY. It prints and
 * exits when the argv asks for help AND this file is the one that was run,
 * and returns `false` otherwise so the caller reads as a guard rather than as
 * a statement with a hidden exit.
 *
 * @param {string} metaUrl  the caller's `import.meta.url`
 * @returns {false}
 */
export function argvHelp(metaUrl, { argv = process.argv } = {}) {
    if (!wantsHelp(argv) || !isEntryPoint(metaUrl, argv)) return false;
    process.stdout.write(`${helpText(fileURLToPath(metaUrl))}\n`);
    process.exit(0);
    /* c8 ignore next */
    return false;
}
