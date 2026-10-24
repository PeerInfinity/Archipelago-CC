/**
 * A COMMIT UNDER A FOREIGN BOX LOCK IS REFUSED — the logic behind
 * scripts/git-hooks/pre-commit (BOX PROTOCOL P0).
 *
 * The box lock freezes a TREE as well as the box: `frozen.head` plus a digest
 * of the tracked porcelain (scripts/procgen/boxLock.js, `treeState`). On
 * 2026-09-12 a commit landed under another session's lock and made its frozen
 * head stale — twice, once in each direction (queue-doc §5x; trap 1336:
 * reading the lock is not honouring it). A lock that only a reader honours is
 * a header warning, so the commit itself asks.
 *
 * The rule, and what it deliberately does NOT refuse:
 *  · REFUSE when a LIVE holder's lock names THIS tree (the lock's `repo` and
 *    `git rev-parse --show-toplevel` resolve to the same directory) and this
 *    process does not carry the holder's token.
 *  · ALLOW a lock on ANOTHER tree — a lock on the primary tree does not stop a
 *    commit in a worktree, which is exactly why concurrent slices run in
 *    worktrees.
 *  · ALLOW the holder's own child (its token inherited: a holder that commits
 *    as part of its run is not moving somebody else's tree).
 *  · ALLOW a dead holder (boxLock.js reclaims those; they freeze nothing).
 *  · ALLOW with `BOX_LOCK_COMMIT_ANYWAY=1`, which prints that it was used.
 *
 * Installed per clone or worktree with `git config core.hooksPath scripts/git-hooks`
 * (scripts/dev/new-worktree.sh sets it).
 */

import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

import { BOX_LOCK_TOKEN_ENV, boxLockHolder, treeState } from '../procgen/boxLock.js';

/** The override: set to `1` to commit under a foreign lock anyway. */
export const COMMIT_ANYWAY_ENV = 'BOX_LOCK_COMMIT_ANYWAY';

const real = (p) => { try { return realpathSync(p); } catch { return p; } };

/**
 * Decide. Pure over its inputs so each branch is a row: `holder` is the live
 * holder or null, `toplevel` the committing tree, `env` the hook's environment.
 * @returns {{allow: boolean, why: string}}
 */
export function commitDecision({ holder, toplevel, env }) {
  if (!holder) return { allow: true, why: 'no-live-holder' };
  if (real(holder.repo) !== real(toplevel)) return { allow: true, why: 'other-tree' };
  if (env[BOX_LOCK_TOKEN_ENV] && env[BOX_LOCK_TOKEN_ENV] === holder.token) {
    return { allow: true, why: 'holder-child' };
  }
  if (env[COMMIT_ANYWAY_ENV] === '1') return { allow: true, why: 'override' };
  return { allow: false, why: 'foreign-holder' };
}

/** Run the hook: print, and return the exit code. */
export function main({ env = process.env, cwd = process.cwd() } = {}) {
  const holder = boxLockHolder();
  if (!holder) return 0;
  let toplevel;
  try {
    toplevel = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim();
  } catch {
    return 0;
  }
  const { allow, why } = commitDecision({ holder, toplevel, env });
  if (why === 'other-tree') return 0;
  const head = holder.frozen?.head ?? '(none)';
  if (why === 'holder-child') {
    console.error(`# box lock: committing UNDER ${holder.name} (pid ${holder.pid}) — its own child`);
    return 0;
  }
  if (why === 'override') {
    console.error(`# box lock: ${COMMIT_ANYWAY_ENV}=1 USED — committing under ${holder.name}'s `
      + `lock (pid ${holder.pid}); its frozen head ${head} is stale from this commit on`);
    return 0;
  }
  let moved = '';
  try {
    const now = treeState({ repo: toplevel });
    moved = now.head === holder.frozen?.head && now.tracked === holder.frozen?.tracked
      ? '   tree now  unmoved since the freeze — this commit would be the move\n'
      : '   tree now  ALREADY MOVED since the freeze\n';
  } catch { /* an unborn HEAD has no state to compare */ }
  console.error(`⛔ COMMIT REFUSED — the box lock on this tree belongs to another process, and a `
    + 'commit would move the tree it froze.\n'
    + `   holder    ${holder.name} (${holder.kind})\n`
    + `   pid       ${holder.pid} on ${holder.hostname}\n`
    + `   since     ${holder.since}\n`
    + `   frozen    ${head}\n`
    + `   tree      ${holder.repo}\n`
    + moved
    + `   ⛓ wait for the lock to go, or commit from a worktree; to commit anyway: `
    + `${COMMIT_ANYWAY_ENV}=1 git commit …`);
  return allow ? 0 : 1;
}
