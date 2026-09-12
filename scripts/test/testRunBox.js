/**
 * `npm test` TAKES THE BOX — the lock half of scripts/test/run-tests.js.
 *
 * Until this module existed the browser suite took no lock at all: on
 * 2026-09-12 a triage `npm test` started five seconds before another slice's
 * locked measurement and ran straight into it (queue-doc §5x, trap 1324). The
 * laws are `scripts/procgen/boxLock.js`'s — one lock, one holder, a holder's
 * child passes through on the token, a refusal is a printed sentence and an
 * exit code — and this file only applies them to the runner:
 *
 *  · The lock is taken BEFORE Playwright is spawned, so a refused run spends
 *    nothing. The default is to REFUSE (exit 1, naming the holder);
 *    `--wait-for-box=<sec>` queues instead, exactly as it does for the gates.
 *  · The frozen tree is THIS runner's tree, so a worktree run freezes its own
 *    head, and the in-app results file records that head and whether the tree
 *    moved under the run (`frozen`, `treeMoved`) — a stale frozen head shows
 *    up in the record instead of in somebody's chat.
 *  · A signal is FORWARDED to Playwright and the lock is released only once
 *    Playwright is gone (bounded by `CHILD_GRACE_SEC`): a lock released while
 *    the browsers are still shutting down is a box the next taker measures on.
 *
 * ⛔ The forwarding listeners are added only AFTER the lock is taken, and
 * PREPENDED. While queuing, no listener may exist at all: the queue loop is
 * synchronous, so a listener could not run — it would only suppress the
 * default action, and a SIGTERM'd queued run would live on to take the box
 * later (trap 1338; boxLock.js detaches its own for the same reason). Once
 * held, ours must run before boxLock.js's own, which releases and exits.
 *
 * `boxLock.js` is imported lazily so that importing this module's pure
 * helpers (a vitest row) registers no signal listeners in the importer.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The tree this runner lives in — the tree whose head a run freezes. */
export const RUNNER_REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The flag that queues instead of refusing — the gates' own spelling. */
export const WAIT_FOR_BOX_FLAG = '--wait-for-box=';

/** How long a signalled runner waits for Playwright before releasing anyway. */
export const CHILD_GRACE_SEC = 20;

/** Where app.spec.js writes the per-run results (relative to the run's cwd). */
export const RESULTS_SUBDIR = join('test-results', 'in-app-tests');

/** The lock's `name` for a run — what the NEXT taker's refusal prints. */
export function runLockName({ mode, batch, testIds }) {
  return `npm test ${mode}${batch ? ` batch=${batch}` : ''}${testIds ? ` test=${testIds}` : ''}`;
}

/**
 * `--wait-for-box=<sec>` from argv, or `npm test --wait-for-box=<sec>` via npm
 * config. A value that is not a non-negative number is refused by name rather
 * than read as 0 — a typo must not turn a queue into a refusal silently, nor
 * the reverse.
 */
export function waitSecFrom(argv, env = process.env) {
  const hit = argv.find((a) => a.startsWith(WAIT_FOR_BOX_FLAG));
  const raw = hit ? hit.slice(WAIT_FOR_BOX_FLAG.length) : (env.npm_config_wait_for_box ?? '');
  if (raw === '') return 0;
  const sec = Number(raw);
  if (!Number.isFinite(sec) || sec < 0) {
    throw new Error(`${WAIT_FOR_BOX_FLAG}<seconds> must be a non-negative number, got ${JSON.stringify(raw)}`);
  }
  return sec;
}

/** Is `pid` still a running process (a zombie awaiting reaping counts as gone)? */
function running(pid) {
  const r = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
  const stat = (r.stdout || '').trim();
  return stat !== '' && !stat.startsWith('Z');
}

/** The signals forwarded to Playwright — boxLock.js's release set. */
export const FORWARDED_SIGNALS = Object.freeze(['SIGINT', 'SIGTERM', 'SIGHUP']);

let CHILD = null;
/** Register the child the signal handlers forward to. */
export function trackChild(child) {
  CHILD = child;
  child.on('exit', () => { if (CHILD === child) CHILD = null; });
}

/**
 * Forward a signal to Playwright and wait (synchronously, bounded) for it to
 * go. Runs BEFORE boxLock.js's own handler, which then releases and exits.
 */
function forwardAndWait(sig) {
  const child = CHILD;
  if (!child || child.exitCode !== null) return;
  try { child.kill(sig); } catch { return; }
  const deadline = Date.now() + CHILD_GRACE_SEC * 1000;
  while (Date.now() < deadline && running(child.pid)) {
    spawnSync('sleep', ['0.2']);
  }
  if (running(child.pid)) {
    console.log(`# box lock: Playwright (pid ${child.pid}) outlived ${CHILD_GRACE_SEC}s after `
      + `${sig}; releasing the box anyway`);
  }
}

/**
 * Take the box for this run, or refuse by name.
 *
 * Returns `{ box, frozen }` where `box` is `'taken'`, `'passthrough'` (a
 * holder's child — the token in the environment, not a second taker) or
 * `'unavailable'` (the lock directory could not be written — a CI runner with
 * an unwritable cache must not fail the run over a lock nothing contends for;
 * this is said out loud). On a held box it prints the holder and exits 1.
 */
export async function takeRunBox({ name, waitSec, repo = RUNNER_REPO }) {
  const { takeBoxLock, treeState } = await import('../procgen/boxLock.js');
  let box;
  try {
    const took = takeBoxLock({ name, kind: 'browser', repo, waitSec });
    box = took.passthrough ? 'passthrough' : 'taken';
  } catch (e) {
    if (!e.code) {
      /* the refusal: a sentence and an exit code, never a stack trace */
      console.log(e.message);
      process.exit(1);
    }
    console.log(`# box lock: UNAVAILABLE (${e.code}: ${e.message}) — ${name} runs WITHOUT `
      + 'the box lock');
    box = 'unavailable';
  }
  for (const sig of FORWARDED_SIGNALS) process.prependListener(sig, () => forwardAndWait(sig));
  /* The run's OWN frozen state, even under a holder: the holder may have frozen
   * another tree, and the record is about this run's tree. */
  return { box, frozen: safeTreeState(treeState, repo) };
}

function safeTreeState(treeState, repo) {
  try { return treeState({ repo }); } catch { return null; }
}

/** The results files present now — so the ones a run wrote are a set difference. */
export function resultsFiles(cwd = process.cwd()) {
  const dir = join(cwd, RESULTS_SUBDIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('test-results-') && f.endsWith('.json'))
    .map((f) => join(dir, f));
}

/**
 * Stamp `frozen` and `treeMoved` into every results file this run wrote
 * (`before` = `resultsFiles()` taken before Playwright started). `now` is the
 * tree state at the end; `treeMoved` is null when either state is unknown.
 * Returns the stamped paths.
 */
export function stampResults({ before, frozen, now, cwd = process.cwd() }) {
  const seen = new Set(before);
  const treeMoved = frozen && now
    ? frozen.head !== now.head || frozen.tracked !== now.tracked
    : null;
  const stamped = [];
  for (const file of resultsFiles(cwd).filter((f) => !seen.has(f))) {
    try {
      const data = JSON.parse(readFileSync(file, 'utf8'));
      writeFileSync(file, JSON.stringify({ ...data, frozen, treeMoved }, null, 2));
      stamped.push(file);
    } catch (e) {
      console.log(`# box lock: could not stamp ${file} (${e.message})`);
    }
  }
  if (treeMoved) {
    console.log(`# box lock: ⚠ THE TREE MOVED UNDER THIS RUN — head ${frozen.head.slice(0, 10)} `
      + `-> ${now.head.slice(0, 10)}, tracked ${frozen.trackedLines} -> ${now.trackedLines} `
      + 'change(s); the results file records treeMoved: true');
  }
  return { stamped, treeMoved };
}

/** The end-of-run tree state (null when the tree cannot be read). */
export async function endTreeState(repo = RUNNER_REPO) {
  const { treeState } = await import('../procgen/boxLock.js');
  return safeTreeState(treeState, repo);
}
