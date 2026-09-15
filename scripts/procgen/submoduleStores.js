/**
 * submoduleStores — **A THROWAWAY WORKTREE'S SUBMODULES, CLONED FROM THE
 * PRIMARY TREE'S OWN OBJECT STORES, NOT FROM THE NETWORK** (slice
 * seedling-headless-G1, 2026-09-15).
 *
 * `check-procgen-help.mjs` drives its children in a `git worktree add` at HEAD
 * and then runs `git submodule update --init` there. A linked worktree shares
 * the superproject's objects but NOT its submodules' — each submodule is a
 * separate clone — so that init fetched every submodule over https on every
 * run (measured at `cf0cd3fdb9`: with `GIT_ALLOW_PROTOCOL=file` the init dies
 * on `fatal: transport 'https' not allowed`).
 *
 * ⛔ `git submodule update --reference <dir>` IS NOT THE ANSWER. `--reference`
 * is handed to `git clone`, which still CONNECTS to the URL to list its refs;
 * it only saves the object transfer. An offline run fails the same way.
 *
 * ⛓ WHAT THIS DOES INSTEAD: for every submodule `.gitmodules` declares whose
 * store exists in the primary tree, one `url.<store>.insteadOf=<url>` rewrite,
 * handed to git as `-c` pairs (they reach the inner `git clone` through
 * `GIT_CONFIG_PARAMETERS`). The clone is then a LOCAL clone of that store —
 * hardlinked objects on the same filesystem, no transport. The rewrite happens
 * at transport time only: the throwaway's recorded `remote.origin.url` stays
 * the real URL. `protocol.file.allow=always` is owed because git ≥ 2.38.1
 * refuses the file transport inside `submodule update` by default.
 *
 * ⛓ THE SET IS DERIVED, never named: a submodule added tomorrow is borrowed
 * without an edit. A submodule the primary has NOT initialised has no store to
 * borrow — it is returned in `missing` so the caller can say so by name; it is
 * not silently fetched.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const gitOut = (cwd, args) => execFileSync('git', args,
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/**
 * Every `.gitmodules` entry of `repo`, with the primary's store for it when it
 * has one: `{ borrowed: [{ path, url, store }], missing: [{ path, url }] }`.
 */
export function submoduleStores(repo) {
    let listing = '';
    try {
        listing = gitOut(repo, ['config', '-f', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$']);
    } catch { return { borrowed: [], missing: [] }; }
    const borrowed = [];
    const missing = [];
    for (const line of listing.split('\n').filter(Boolean)) {
        const [key, path] = line.split(/\s+/, 2);
        const name = key.replace(/^submodule\./, '').replace(/\.path$/, '');
        /**
         * ⛔ THE URL GIT WILL CLONE is the superproject's own config entry when
         * there is one (a `submodule sync` writes it), and `.gitmodules` only
         * otherwise — a rewrite keyed on the wrong one never matches, and the
         * clone goes to whatever the config names.
         */
        let url;
        try { url = gitOut(repo, ['config', `submodule.${name}.url`]); } catch {
            url = gitOut(repo, ['config', '-f', '.gitmodules', `submodule.${name}.url`]);
        }
        const dir = join(repo, path);
        let store = null;
        /**
         * ⛓ `rev-parse --absolute-git-dir` answers both shapes: the absorbed
         * `.git/modules/<name>` a gitfile points at, and an EMBEDDED `.git`
         * directory (this repo's `flashPanel/wasm`). ⛔ The toplevel check
         * keeps an uninitialised (empty) path from answering with the
         * SUPERPROJECT's own gitdir.
         */
        if (existsSync(join(dir, '.git'))) {
            try {
                if (gitOut(dir, ['rev-parse', '--show-toplevel']) === realpathSync(dir)) {
                    store = gitOut(dir, ['rev-parse', '--absolute-git-dir']);
                }
            } catch { store = null; }
        }
        if (store && isAbsolute(store)) borrowed.push({ path, url, store });
        else missing.push({ path, url });
    }
    return { borrowed, missing };
}

/** The `-c` arguments that make `git submodule update --init` clone from `borrowed`. */
export function borrowArgs(borrowed) {
    if (!borrowed.length) return [];
    return [
        '-c', 'protocol.file.allow=always',
        ...borrowed.flatMap(({ url, store }) => ['-c', `url.${store}.insteadOf=${url}`]),
    ];
}
