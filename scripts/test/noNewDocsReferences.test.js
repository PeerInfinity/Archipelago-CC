/**
 * ⛔ NO TRACKED FILE POINTS INTO `NewDocs/`.
 *
 * `NewDocs/` is gitignored (`.gitignore`): a clone, a linked worktree, a cloud
 * session and CI do not have it. A tracked file that names a path there is a
 * dead pointer for every reader but one machine, and a tracked SCRIPT that
 * reads or writes there does not work anywhere else. The 2026-07-01 sweep made
 * the code NewDocs-free and nothing held it, so 80 files drifted back by
 * 2026-10-04; this test is what holds the second sweep
 * (`CC/docs/newdocs-reference-map.md`).
 *
 * Instead of a pointer: cite the TRACKED doc that carries the design, name the
 * slice (e.g. "solver-walk W2") without the plan's path, or — for a tool —
 * write scratch output under the gitignored `.cache/` and take any other
 * location as an argument or environment variable.
 *
 * The allowlist reds BOTH ways: a new mention outside it fails, and an entry
 * that no longer mentions NewDocs fails too, so the list cannot go stale.
 * `git grep --untracked` (new files count before their commit; ignored ones
 * never do) without `-I`, so a file carrying stray NUL bytes (several tracked
 * sources do) is searched, not silently skipped as binary.
 */
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** path (or `dir/` prefix) → why it may say "NewDocs" */
const ALLOWED = {
    '.gitignore': 'the ignore rule itself',
    'CC/overview.md': 'says what the NewDocs directory is',
    'CC/docs/cleanup-backlog.md': 'explains why items were copied out of the untracked tree',
    'CC/docs/newdocs-reference-map.md': 'the record of both sweeps',
    'docs/json/developer/diffs/diff-files/config-files.diff': 'a recorded diff of .gitignore',
    'frontend/modules/procgenDocs/glossary.js': 'the glossary\'s own no-NewDocs guard',
    'frontend/modules/procgenDocs/glossary.test.js': 'the glossary guard\'s test',
    'scripts/procgen/reference/instruments.mjs': 'skips the directory when searching the tree',
    'scripts/test/noNewDocsReferences.test.js': 'this guard',
    'CC/docs/cloud-reports/': 'historical run records (survey output paths at the time of the run)',
};

const allowedBy = (path) => Object.keys(ALLOWED)
    .find((k) => (k.endsWith('/') ? path.startsWith(k) : path === k)) ?? null;

function mentioning() {
    try {
        return execFileSync('git', ['grep', '--untracked', '-l', '-z', '-F', 'NewDocs'], { cwd: REPO, encoding: 'utf8' })
            .split('\0').filter(Boolean);
    } catch (e) {
        if (e.status === 1) return []; // git grep: no match
        throw e;
    }
}

describe('tracked files and the gitignored NewDocs tree', () => {
    const hits = mentioning();

    it('⛔ no tracked file outside the allowlist mentions NewDocs', () => {
        const offenders = hits.filter((p) => !allowedBy(p));
        expect(offenders, 'cite a tracked doc or the slice name instead; '
            + 'tools write scratch output under .cache/').toEqual([]);
    });

    it('every allowlist entry still mentions NewDocs (the list cannot go stale)', () => {
        const stale = Object.keys(ALLOWED).filter((k) => !hits.some((p) => allowedBy(p) === k));
        expect(stale).toEqual([]);
    });
});
