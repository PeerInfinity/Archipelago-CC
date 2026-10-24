/**
 * submoduleIdentity — the rows (slice seedling-headless-C3, plan §22 item 1).
 *
 * ⛓ Every row builds a THROWAWAY git repo in a temp dir: the real pair
 * (`7ae2d5a -> 8c20769`) exists only in a checkout that still holds the old
 * object, which a CI clone does not — so the real pair is measured by driving
 * the gate (`--base=`), and the clause's three cases are proven here.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { SHED_HISTORY_PATH, submoduleTreeIdentity } from './submoduleIdentity.js';

const made = [];
afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A repo with a wasm, a README and the history file; returns its first commit. */
function repo() {
    const dir = mkdtempSync(join(tmpdir(), 'sub-identity-'));
    made.push(dir);
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim();
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 't');
    git('config', 'user.email', 't@t');
    mkdirSync(join(dir, 'docs'));
    mkdirSync(join(dir, 'game'));
    writeFileSync(join(dir, 'game', 'game.wasm'), Buffer.from([0, 97, 115, 109, 1]));
    writeFileSync(join(dir, 'README.md'), '# builds\n');
    writeFileSync(join(dir, SHED_HISTORY_PATH), '# history\n');
    git('add', '-A');
    git('commit', '-qm', 'one');
    const commit = (msg, edit) => { edit(); git('add', '-A'); git('commit', '-qm', msg); return git('rev-parse', 'HEAD'); };
    return { dir, git, first: git('rev-parse', 'HEAD'), commit };
}

describe('submoduleTreeIdentity — the owed gate\'s (i) learns tree identity', () => {
    it('two commits differing in docs/history.md ALONE are the same game', () => {
        const r = repo();
        const now = r.commit('shed', () => writeFileSync(join(r.dir, SHED_HISTORY_PATH), '# history\n## The shed\n'));
        const v = submoduleTreeIdentity({ dir: r.dir, before: r.first, now });
        expect(v.same).toBe(true);
        expect(v.line).toBe(`${r.first.slice(0, 12)} -> ${now.slice(0, 12)} identical outside docs/history.md — the same game`);
    });

    it('one byte in a .wasm is a different game — owed, naming the path', () => {
        const r = repo();
        const now = r.commit('rebuild', () => {
            writeFileSync(join(r.dir, SHED_HISTORY_PATH), '# history\n## rebuilt\n');
            writeFileSync(join(r.dir, 'game', 'game.wasm'), Buffer.from([0, 97, 115, 109, 2]));
        });
        const v = submoduleTreeIdentity({ dir: r.dir, before: r.first, now });
        expect(v.same).toBe(false);
        expect(v.line).toMatch(/differ outside docs\/history\.md in 1 path\(s\): game\/game\.wasm — owed$/);
    });

    it('⛔ only docs/history.md is excluded: a README change is a build change', () => {
        const r = repo();
        const now = r.commit('readme', () => writeFileSync(join(r.dir, 'README.md'), '# builds!\n'));
        expect(submoduleTreeIdentity({ dir: r.dir, before: r.first, now }).same).toBe(false);
    });

    it('the old object deleted (a fresh clone after a shed) cannot compare — owed, never a throw', () => {
        const r = repo();
        const before = r.first;
        // ⛓ The shed shape: an ORPHAN carrying the same tree plus the history
        // section, then the old branch dropped and its objects pruned.
        r.git('checkout', '-q', '--orphan', 'shed');
        writeFileSync(join(r.dir, SHED_HISTORY_PATH), '# history\n## The shed\n');
        r.git('add', '-A');
        r.git('commit', '-qm', 'shed');
        const now = r.git('rev-parse', 'HEAD');
        r.git('branch', '-D', 'main');
        r.git('reflog', 'expire', '--expire=now', '--all');
        r.git('gc', '-q', '--prune=now');
        expect(() => r.git('cat-file', '-e', `${before}^{commit}`)).toThrow();
        const v = submoduleTreeIdentity({ dir: r.dir, before, now });
        expect(v.same).toBe(false);
        expect(v.line).toBe(`cannot compare (object ${before.slice(0, 12)} absent) — owed`);
    });

    it('a directory that is not its own checkout (an uninitialised submodule) cannot compare — owed', () => {
        const r = repo();
        const empty = join(r.dir, 'uninit');
        mkdirSync(empty);
        const v = submoduleTreeIdentity({ dir: empty, before: r.first, now: r.first });
        expect(v.same).toBe(false);
        expect(v.line).toMatch(/^cannot compare \(no submodule checkout at .*uninit\) — owed$/);
    });
});

describe('check-seedling-full-tier-owed --base= — the category line names the what-if (C4)', () => {
    it('under --base=HEAD every category line says it was judged against --base=, never "its OWN head"', () => {
        // ⛓ `--base=HEAD` so the verdict cannot move with the standing row: every
        // diff is HEAD..HEAD, and a depth-1 CI clone resolves HEAD.
        const gate = join(dirname(fileURLToPath(import.meta.url)), 'check-seedling-full-tier-owed.mjs');
        const out = execFileSync('node', [gate, '--base=HEAD'], { encoding: 'utf8' });
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
        const lines = out.split('\n').filter((l) => /category is still about THIS tree/.test(l));
        expect(lines.length).toBeGreaterThan(0);
        for (const l of lines) {
            expect(l).toContain(`judged against --base=HEAD (what-if) @${head.slice(0, 9)}`);
            expect(l).not.toContain('OWN head');
        }
    });
});
