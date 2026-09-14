/**
 * submoduleIdentity — **A GITLINK THAT MOVED ONTO THE SAME GAME** (slice
 * seedling-headless-C3, 2026-09-14; plan
 * `NewDocs/plans/seedling-headless-webgpu-plan.md` §22 item 1).
 *
 * ── ⛔⛔ WHY (i) NEEDED A SECOND QUESTION ──────────────────────────────
 *
 * `check-seedling-full-tier-owed`'s population (i) compared the wasm gitlink's
 * SHAs, full stop. The seedling-wasm history SHED (§21.3) moved the gitlink
 * `7ae2d5a -> 8c20769` onto an orphan commit whose tree is byte-identical to
 * the old one apart from `docs/history.md` — the shed policy APPENDS a dated
 * section there — and the gate read all three categories owed. The cure was a
 * hand-made re-quote of three parts, and it recurs at every shed.
 *
 * W3 §17.1 (2) found why the naive "empty submodule tree diff owes no drive"
 * clause cannot be written as said, and both halves are this file:
 *
 *   THE EXCLUSION   the diff is EMPTY only with `-- . ':!docs/history.md'`,
 *                   because the shed itself writes that file. ⛔ ONLY that
 *                   file: a README or `builds.json` change is a build change
 *                   (the manifest-prose exemption has its own three clauses
 *                   and is NOT this one).
 *   BOTH OBJECTS    the diff needs the OLD commit, and a CI fresh clone after a
 *                   shed cannot fetch it once `main` stops reaching it. Then the
 *                   honest answer is today's: "cannot compare — owed". Never a
 *                   throw, never a clear.
 *
 * ⛓ Direction of error, the gate's own: a spurious "owed" costs a reader ten
 * seconds; a spurious clear is a standing value quietly about another game.
 * So every case that is not BOTH objects present AND an empty excluded diff is
 * owed, exactly as before.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

/** The one path a shed writes; the only path the identity may ignore. */
export const SHED_HISTORY_PATH = 'docs/history.md';

const gitIn = (dir) => (...args) => execFileSync('git', ['-C', dir, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 27 }).trim();

/**
 * Is the submodule at `before` the same game as at `now`?
 *
 * @param {object} o
 * @param {string} o.dir     the submodule checkout (absolute)
 * @param {string} o.before  the gitlink SHA the measurement was taken under
 * @param {string} o.now     the gitlink SHA at HEAD
 * @returns {{ same: boolean, line: string }}  `same` true ONLY when both
 *   objects exist in `dir` and the diff outside `SHED_HISTORY_PATH` is empty;
 *   `line` is what the gate prints either way.
 */
export function submoduleTreeIdentity({ dir, before, now }) {
    const git = gitIn(dir);
    const b = before.slice(0, 12);
    const n = now.slice(0, 12);
    /**
     * ⛓ An UNINITIALISED submodule is an empty directory inside the outer
     * tree, and `git -C` there answers for the OUTER repo. Its objects are not
     * the submodule's, so that is "cannot compare", not a lookup.
     */
    let top = null;
    try { top = git('rev-parse', '--show-toplevel'); } catch { /* not a repo */ }
    if (top === null || resolve(top) !== resolve(dir)) {
        return { same: false, line: `cannot compare (no submodule checkout at ${dir}) — owed` };
    }
    for (const sha of [before, now]) {
        try { git('cat-file', '-e', `${sha}^{commit}`); } catch {
            return { same: false, line: `cannot compare (object ${sha.slice(0, 12)} absent) — owed` };
        }
    }
    const moved = git('diff', '--name-only', before, now, '--', '.', `:!${SHED_HISTORY_PATH}`)
        .split('\n').filter(Boolean);
    if (moved.length) {
        return { same: false, line: `${b} -> ${n} differ outside ${SHED_HISTORY_PATH} in `
            + `${moved.length} path(s): ${moved.slice(0, 5).join(', ')}${moved.length > 5 ? ', …' : ''} — owed` };
    }
    return { same: true, line: `${b} -> ${n} identical outside ${SHED_HISTORY_PATH} — the same game` };
}
