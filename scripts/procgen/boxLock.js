/**
 * boxLock — **ONE BOX, ONE HOLDER, AND THE TREE FROZEN WITH IT**
 * (R9 slice P3b, ⚖ ruling 54 (7); trap 800; §44.9 item 5).
 *
 * ── ⛔⛔ WHAT THIS REPLACES ────────────────────────────────────────────
 *
 * Session 5 of the R9 campaign spent about **twelve hand-relayed "BOX BUSY" /
 * "BOX FREE" messages** between an orchestrator and its slices, because the
 * `:8000` browser gates, the Windows/GPU rows and `standing-values --write`
 * all measure TIMING on one machine and perturb each other. A protocol whose
 * enforcement is a human retyping two words is a protocol that fails on the
 * message nobody sent.
 *
 * ── ⛔⛔⛔ AND WHY IT FREEZES THE TREE, NOT ONLY THE BOX ───────────────
 *
 * §44.9 item 5, learned by breaking it. R9 slice P3 appended a passage to a
 * TRACKED doc *while its own `standing-values --write` was measuring*, and the
 * row whose whole job is to assert the generated regions match the docs came
 * back `EXIT1` at row 22 of 62. **"The box is busy" and "the tree is frozen"
 * are two different claims, and a measurement pass needs both** — a lock that
 * only serialised `:8000` access would not have stopped that edit. So the lock
 * records the FROZEN HEAD and a digest of the working tree's TRACKED state,
 * and `assertTreeUnmoved` lets a measuring instrument refuse BY NAME, at the
 * row where it happened, instead of publishing a number about a tree that no
 * longer exists.
 *
 * ── WHERE THE FILE LIVES, AND WHY NOT `/tmp/claude-1000/…` ───────────
 *
 * `~/.cache/seedling-box/lock.json` (`$XDG_CACHE_HOME` honoured).
 *   · ⛔ NOT a scratchpad. A session scratchpad is per-SESSION by construction,
 *     so a lock inside one would give every session its own lock and serialise
 *     nothing — which is the exact failure the hand-relayed protocol had.
 *   · ⛔ NOT inside a worktree. Slices work in their own worktrees; a lock
 *     under one of them is invisible to the others and could be committed.
 *   · ⛓ It is per-USER on one machine, which is the true scope of the resource
 *     being contended: the GPU, the dev server's port, and the CPU that every
 *     timing row is measured against.
 *
 * ── THE FOUR RULES ───────────────────────────────────────────────────
 *
 *  1. A second taker **REFUSES BY NAME**, printing the holder's `pid`, `name`,
 *     `since` and frozen `head`, and the exact `--wait-for-box=` line that
 *     would have queued instead. ⛔ Refuse, not hang: an instrument that waits
 *     silently is indistinguishable from a stalled session, and a stalled
 *     session is the more expensive of the two failures to diagnose.
 *  2. A **STALE** holder — its pid fails `kill -0` — is reclaimed, with a
 *     printed notice naming what was reclaimed and from whom. A lock that can
 *     outlive a killed process is a lock that has to be deleted by hand.
 *  3. **RE-ENTRANCY IS BY TOKEN, NOT BY PID.** `gates.mjs` takes the lock and
 *     then spawns twenty-seven gates that each take it too; without this every
 *     run would deadlock against itself. The holder exports its token in the
 *     environment and a child carrying that token PASSES THROUGH, saying so.
 *  4. The lock is released on `exit` and on `SIGINT`/`SIGTERM`/`SIGHUP`, and
 *     only by the process that took it.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';

/** ⛓ Per-user, per-machine — the true scope of the box being contended. */
export const BOX_LOCK_DIR = join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'),
    'seedling-box');
export const BOX_LOCK_FILE = join(BOX_LOCK_DIR, 'lock.json');
/** ⛓ How a child of the holder proves it is not a second taker (rule 3). */
export const BOX_LOCK_TOKEN_ENV = 'SEEDLING_BOX_LOCK_TOKEN';

/**
 * The kinds a taker declares. They are recorded and PRINTED rather than used
 * to decide anything: ⛔ there is ONE lock and ONE holder. An `own-port`
 * browser sweep on `:8126` does not contend for `:8000`, but it does contend
 * for the GPU and for the CPU every `cheap` band is measured against (§44.11),
 * so it queues like everything else. A lock with per-kind exceptions is a lock
 * whose rules nobody can hold in their head at 2 a.m.
 */
export const BOX_LOCK_KINDS = Object.freeze(['browser', 'windows', 'own-port', 'measure']);

const say = (line) => console.log(line);

/** ⛓ Alive? `kill -0` is the only form immune to a pattern matching itself. */
function alive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function readLock() {
    if (!existsSync(BOX_LOCK_FILE)) return null;
    try { return JSON.parse(readFileSync(BOX_LOCK_FILE, 'utf8')); } catch { return null; }
}

const git = (repo, args) => execFileSync('git', args,
    { cwd: repo, encoding: 'utf8', maxBuffer: 1 << 26 }).trim();

/**
 * ⛓⛓⛓ THE TREE'S STATE, AS ONE COMPARABLE VALUE — and it says what it BOUNDS.
 *
 * ⛔ IT IS DELIBERATELY NOT "THE TREE IS CLEAN". A slice's primary tree
 * legitimately carries staged work and another session's files; refusing on
 * dirtiness would refuse every real `--write`. What a measurement needs is
 * that the tree has not MOVED under it, so the frozen value is a digest and
 * the check is equality against it.
 *
 * ⛔ UNTRACKED (`??`) PATHS ARE EXCLUDED, AND THAT IS NAMED. A measuring run
 * writes logs, run directories and reports; every one of those would otherwise
 * read as the tree moving. What is frozen is HEAD plus the TRACKED porcelain —
 * which is exactly the population §44.9 item 5's tracked-doc edit was in.
 */
export function treeState({ repo }) {
    const head = git(repo, ['rev-parse', 'HEAD']);
    const porcelain = git(repo, ['status', '--porcelain'])
        .split('\n')
        .filter((l) => l.trim() && !l.startsWith('??'))
        .sort()
        .join('\n');
    return {
        head,
        tracked: createHash('md5').update(porcelain).digest('hex'),
        trackedLines: porcelain ? porcelain.split('\n').length : 0,
    };
}

let HELD = null;

function release() {
    if (!HELD) return;
    const cur = readLock();
    /** ⛓ …and only the lock WE took — never somebody else's reclaim of it. */
    if (cur && cur.token === HELD.token) rmSync(BOX_LOCK_FILE, { force: true });
    HELD = null;
}

/** Release the lock this process holds. Safe to call when it holds none. */
export function releaseBoxLock() { release(); }

/**
 * Take the box lock, or refuse by name.
 *
 * @param {object} o
 * @param {string} o.name       who is taking it — printed to the next taker
 * @param {string} o.kind       one of `BOX_LOCK_KINDS`
 * @param {string} o.repo       the tree whose HEAD and porcelain are frozen
 * @param {number} [o.waitSec]  queue for up to this many seconds instead of
 *                              refusing (`--wait-for-box=<sec>`)
 * @param {boolean} [o.quiet]   suppress the "took" line (a child pass-through)
 * @returns {{token: string, frozen: object, passthrough: boolean}}
 */
export function takeBoxLock({ name, kind, repo, waitSec = 0, quiet = false }) {
    if (!name) throw new Error('boxLock: takeBoxLock needs a `name` — a refusal that cannot '
        + 'say WHO is holding the box is the hand-relayed protocol with extra steps');
    if (!BOX_LOCK_KINDS.includes(kind)) {
        throw new Error(`boxLock: unknown kind ${JSON.stringify(kind)} — one of `
            + `${BOX_LOCK_KINDS.join(', ')}`);
    }
    /* ── rule 3: a child of the holder is not a second taker ── */
    const inherited = process.env[BOX_LOCK_TOKEN_ENV];
    if (inherited) {
        const cur = readLock();
        if (cur && cur.token === inherited) {
            if (!quiet) {
                say(`# box lock: ${name} runs UNDER ${cur.name} (pid ${cur.pid}) — the `
                    + 'holder\'s own child, not a second taker');
            }
            return { token: inherited, frozen: cur.frozen, passthrough: true };
        }
    }

    mkdirSync(BOX_LOCK_DIR, { recursive: true });
    const deadline = Date.now() + waitSec * 1000;
    let announcedWait = false;
    for (;;) {
        const cur = readLock();
        if (cur && alive(cur.pid)) {
            if (Date.now() < deadline) {
                if (!announcedWait) {
                    say(`# box lock: BUSY — ${cur.name} (pid ${cur.pid}, ${cur.kind}) since `
                        + `${cur.since}; queuing for up to ${waitSec}s`);
                    announcedWait = true;
                }
                /* ⛓ a coarse poll: the resource is measured in minutes. */
                execFileSync('sleep', ['2']);
                continue;
            }
            const held = Math.round((Date.now() - Date.parse(cur.since)) / 1000);
            throw new Error(`⛔ THE BOX IS TAKEN — ${name} (${kind}) refuses rather than `
                + `perturbing a live measurement.\n`
                + `   holder   ${cur.name} (${cur.kind})\n`
                + `   pid      ${cur.pid} on ${cur.hostname}\n`
                + `   since    ${cur.since} (${held}s)\n`
                + `   head     ${cur.frozen?.head ?? '(none)'}\n`
                + `   tree     ${cur.repo}\n`
                + `   ⛓ to QUEUE instead of refusing, re-run with `
                + `\`--wait-for-box=<seconds>\`.\n`
                + `   ⛓ if that pid is gone, the next taker reclaims the lock `
                + 'automatically — nothing has to be deleted by hand.');
        }
        if (cur) {
            /* ── rule 2: a dead holder is reclaimed, LOUDLY ── */
            say(`# box lock: RECLAIMED a stale lock from ${cur.name} (pid ${cur.pid}, `
                + `${cur.kind}, since ${cur.since}) — that pid no longer exists`);
        }
        const token = createHash('md5')
            .update(`${process.pid}:${name}:${process.hrtime.bigint()}`).digest('hex');
        const frozen = treeState({ repo });
        const entry = { token, pid: process.pid, name, kind, repo,
            hostname: hostname(), since: new Date().toISOString(), frozen };
        writeFileSync(BOX_LOCK_FILE, `${JSON.stringify(entry, null, 2)}\n`);
        /** ⛔ RE-READ: two takers that raced both wrote; only one is on disk. */
        const won = readLock();
        if (!won || won.token !== token) continue;
        HELD = entry;
        process.env[BOX_LOCK_TOKEN_ENV] = token;
        if (!quiet) {
            say(`# box lock: TAKEN by ${name} (${kind}, pid ${process.pid}) — `
                + `head ${frozen.head.slice(0, 9)}, ${frozen.trackedLines} tracked change(s) `
                + 'frozen (untracked paths excluded: a measuring run writes logs)');
        }
        return { token, frozen, passthrough: false };
    }
}

/**
 * ⛓⛓⛓ THE TREE HALF — call it at every row a measurement writes.
 *
 * ⛔ IT REFUSES BY NAME, WITH THE ROW. §44.11's repair was to re-run the
 * generator and re-measure only the affected rows *after* the damage; the
 * point of doing it per row is that the run stops at the row where the tree
 * moved, so nothing downstream is published about a tree that no longer
 * exists.
 */
export function assertTreeUnmoved({ repo, frozen, row }) {
    const now = treeState({ repo });
    if (now.head === frozen.head && now.tracked === frozen.tracked) return now;
    throw new Error(`⛔ THE TREE MOVED UNDER THIS MEASUREMENT, at row ${JSON.stringify(row)}.\n`
        + `   head   ${frozen.head} -> ${now.head}\n`
        + `   tracked ${frozen.trackedLines} change(s) (${frozen.tracked.slice(0, 12)}) -> `
        + `${now.trackedLines} (${now.tracked.slice(0, 12)})\n`
        + '   ⛓ A standing value is one head\'s answer. R9 slice P3 appended to a TRACKED '
        + 'doc while its own `--write` was measuring and the generated-regions row came back '
        + 'EXIT1 at row 22 of 62 (§44.9 item 5) — this refuses AT the row instead, so nothing '
        + 'downstream is published about a tree that no longer exists.\n'
        + '   ⛓ Re-run the write once the tree is settled; untracked paths are excluded, so '
        + 'a log or a run directory did not cause this.');
}

/** ⛓ The holder right now, or `null` — for a reader that only wants to look. */
export function boxLockHolder() {
    const cur = readLock();
    return cur && alive(cur.pid) ? cur : null;
}

process.on('exit', release);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { release(); process.exit(130); });
}
