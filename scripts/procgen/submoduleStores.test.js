/**
 * submoduleStores — **THE ROWS** (slice seedling-headless-G1).
 *
 * ⛔ "NO NETWORK" IS MEASURED BY AN OFFLINE RUN, not by the absence of log
 * lines: every clone here runs under `GIT_ALLOW_PROTOCOL=file`, which makes an
 * https transport a hard `fatal`. The fixture's submodule URL is https, so the
 * CONTROL row (the same init without the rewrite) must FAIL — that is what
 * proves the environment really is offline, and it is why the borrowing row's
 * green means something.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { borrowArgs, submoduleStores } from './submoduleStores.js';

const URL = 'https://example.invalid/PeerInfinity/fixture-sub.git';
const EMBEDDED_URL = 'https://example.invalid/PeerInfinity/fixture-embedded.git';
const COLD_URL = 'https://example.invalid/PeerInfinity/fixture-cold.git';

const ENV = {
    ...process.env,
    GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid',
    GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid',
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
};
const OFFLINE = { ...ENV, GIT_ALLOW_PROTOCOL: 'file' };
const git = (cwd, args, env = ENV) => execFileSync('git', args,
    { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

let root;
let superRepo;

/** A one-commit repository holding `file`. */
function repoWith(dir, file) {
    mkdirSync(dir, { recursive: true });
    git(dir, ['init', '-q', '-b', 'main']);
    writeFileSync(join(dir, file), `${file}\n`);
    git(dir, ['add', file]);
    git(dir, ['commit', '-q', '-m', file]);
}

beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'submodule-stores-'));
    repoWith(join(root, 'sub'), 'absorbed.txt');
    repoWith(join(root, 'embedded'), 'embedded.txt');
    repoWith(join(root, 'cold'), 'cold.txt');
    superRepo = join(root, 'super');
    repoWith(superRepo, 'README');
    const add = (from, path) => git(superRepo,
        ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', join(root, from), path]);
    add('sub', 'mods/sub');
    add('cold', 'mods/cold');
    /** ⛓ the EMBEDDED shape (`flashPanel/wasm` here): a real `.git` directory in the path. */
    git(root, ['clone', '-q', join(root, 'embedded'), join(superRepo, 'mods/embedded')]);
    const sha = git(join(superRepo, 'mods/embedded'), ['rev-parse', 'HEAD']);
    git(superRepo, ['update-index', '--add', '--cacheinfo', `160000,${sha},mods/embedded`]);
    writeFileSync(join(superRepo, '.gitmodules'), [
        '[submodule "mods/sub"]', '\tpath = mods/sub', `\turl = ${URL}`,
        '[submodule "mods/cold"]', '\tpath = mods/cold', `\turl = ${COLD_URL}`,
        '[submodule "mods/embedded"]', '\tpath = mods/embedded', `\turl = ${EMBEDDED_URL}`, '',
    ].join('\n'));
    git(superRepo, ['add', '.gitmodules']);
    git(superRepo, ['commit', '-q', '-m', 'three submodules, https urls']);
    /**
     * ⛔ AND THE SUPERPROJECT'S CONFIG TOO. `submodule add` from a local path
     * wrote that PATH into `.git/config`, and git clones from the config's URL
     * before `.gitmodules`' — the first cut of this fixture left it, and its
     * "borrowing" row went green by cloning the local path directly.
     */
    git(superRepo, ['submodule', 'sync', '-q']);
    /** ⛓ `cold` is declared and never initialised in the primary: no store to borrow. */
    git(superRepo, ['submodule', 'deinit', '-q', '-f', 'mods/cold']);
    rmSync(join(superRepo, '.git/modules/mods/cold'), { recursive: true, force: true });
});

afterAll(() => { if (root) rmSync(root, { recursive: true, force: true }); });

/** A fresh linked worktree at HEAD, the shape `check-procgen-help` builds. */
function worktree(name) {
    const dir = join(root, name);
    git(superRepo, ['worktree', 'add', '-q', '--detach', dir, 'HEAD']);
    return dir;
}

describe('submoduleStores — the set is derived from .gitmodules', () => {
    it('borrows the absorbed store and the EMBEDDED .git, and names the uninitialised one', () => {
        const { borrowed, missing } = submoduleStores(superRepo);
        expect(borrowed.map((b) => [b.path, b.url, b.store])).toEqual([
            ['mods/sub', URL, join(superRepo, '.git/modules/mods/sub')],
            ['mods/embedded', EMBEDDED_URL, join(superRepo, 'mods/embedded/.git')],
        ]);
        expect(missing).toEqual([{ path: 'mods/cold', url: COLD_URL }]);
    });

    it('a repository with no .gitmodules borrows nothing and refuses nothing', () => {
        expect(submoduleStores(join(root, 'sub'))).toEqual({ borrowed: [], missing: [] });
        expect(borrowArgs([])).toEqual([]);
    });
});

describe('⛔ OFFLINE — a throwaway worktree\'s submodule init', () => {
    const initOffline = (dir, extra) => spawnSync('git',
        [...extra, 'submodule', 'update', '--init', '-q', 'mods/sub', 'mods/embedded'],
        { cwd: dir, env: OFFLINE, encoding: 'utf8' });

    it('CONTROL: without the rewrite the same init FAILS on the https transport — the run is really offline', () => {
        const r = initOffline(worktree('wt-control'), []);
        expect(r.status).not.toBe(0);
        expect(r.stderr).toMatch(/transport 'https' not allowed/);
    });

    it('with borrowArgs it succeeds from the primary\'s stores, and the recorded URL stays the real one', () => {
        const dir = worktree('wt-borrow');
        const r = initOffline(dir, borrowArgs(submoduleStores(superRepo).borrowed));
        expect(r.stderr).toBe('');
        expect(r.status).toBe(0);
        expect(readFileSync(join(dir, 'mods/sub/absorbed.txt'), 'utf8')).toBe('absorbed.txt\n');
        expect(existsSync(join(dir, 'mods/embedded/embedded.txt'))).toBe(true);
        expect(git(join(dir, 'mods/sub'), ['config', 'remote.origin.url'])).toBe(URL);
        expect(git(join(dir, 'mods/embedded'), ['config', 'remote.origin.url'])).toBe(EMBEDDED_URL);
        const status = git(dir, ['submodule', 'status', 'mods/sub', 'mods/embedded']);
        expect(status.split('\n').filter((l) => /^[-+U]/.test(l))).toEqual([]);
    });
});
