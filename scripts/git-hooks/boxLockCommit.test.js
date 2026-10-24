/**
 * The pre-commit hook refuses a commit under a FOREIGN box lock on this tree
 * (BOX PROTOCOL P0).
 *
 * ⛔ The hook is spawned as a CHILD with `XDG_CACHE_HOME` at a temp lock dir:
 * boxLock.js resolves the lock path at import, so a child is the honest
 * instrument — and it keeps every row off the REAL lock another session may
 * hold. One row drives a real `git commit` so the hook is proven INVOKED by
 * git, not merely runnable.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { COMMIT_ANYWAY_ENV, commitDecision } from './boxLockCommit.js';
import { BOX_LOCK_TOKEN_ENV } from '../procgen/boxLock.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const HOOK = join(HERE, 'pre-commit');

let ROOT;
let CACHE;
let SLEEPER;

function writeLock({ repo, pid = SLEEPER.pid, token = 'foreign-token' }) {
  writeFileSync(join(CACHE, 'seedling-box', 'lock.json'), JSON.stringify({
    token, pid, name: 'a-foreign-measurement', kind: 'measure', repo, hostname: 'x',
    since: '2026-09-12T00:00:00.000Z', frozen: { head: 'e'.repeat(40), tracked: 't', trackedLines: 0 },
  }));
}

function hook(env = {}, cwd = REPO) {
  const r = spawnSync(process.execPath, [HOOK], {
    cwd, encoding: 'utf8',
    env: { ...process.env, XDG_CACHE_HOME: CACHE, [BOX_LOCK_TOKEN_ENV]: '', [COMMIT_ANYWAY_ENV]: '', ...env },
  });
  return { exit: r.status, out: `${r.stdout}${r.stderr}` };
}

beforeAll(() => {
  ROOT = mkdtempSync(join(tmpdir(), 'p0-hook-'));
  CACHE = join(ROOT, 'cache');
  mkdirSync(join(CACHE, 'seedling-box'), { recursive: true });
  SLEEPER = spawn('sleep', ['300'], { stdio: 'ignore' });
});
afterAll(() => {
  SLEEPER.kill();
  rmSync(ROOT, { recursive: true, force: true });
});

describe('commitDecision', () => {
  const holder = { repo: REPO, token: 'tok' };
  it('decides each branch', () => {
    expect(commitDecision({ holder: null, toplevel: REPO, env: {} }).why).toBe('no-live-holder');
    expect(commitDecision({ holder: { ...holder, repo: ROOT }, toplevel: REPO, env: {} }).why)
      .toBe('other-tree');
    expect(commitDecision({ holder, toplevel: REPO, env: { [BOX_LOCK_TOKEN_ENV]: 'tok' } }))
      .toEqual({ allow: true, why: 'holder-child' });
    expect(commitDecision({ holder, toplevel: REPO, env: { [COMMIT_ANYWAY_ENV]: '1' } }))
      .toEqual({ allow: true, why: 'override' });
    expect(commitDecision({ holder, toplevel: REPO, env: {} }))
      .toEqual({ allow: false, why: 'foreign-holder' });
    /* an EMPTY inherited token is not the holder's token */
    expect(commitDecision({ holder: { ...holder, token: '' }, toplevel: REPO,
      env: { [BOX_LOCK_TOKEN_ENV]: '' } }).allow).toBe(false);
  });
});

describe('the hook, spawned', () => {
  it('is executable', () => {
    expect(statSync(HOOK).mode & 0o111).not.toBe(0);
  });

  it('refuses a foreign LIVE holder on this tree: exit 1 and the sentence', () => {
    writeLock({ repo: REPO });
    const r = hook();
    expect(r.exit).toBe(1);
    expect(r.out).toContain('⛔ COMMIT REFUSED');
    expect(r.out).toMatch(/holder\s+a-foreign-measurement \(measure\)/);
    expect(r.out).toMatch(new RegExp(`pid\\s+${SLEEPER.pid} on x`));
    expect(r.out).toMatch(/since\s+2026-09-12T00:00:00.000Z/);
    expect(r.out).toMatch(/frozen\s+e{40}/);
    expect(r.out).toContain(`${COMMIT_ANYWAY_ENV}=1 git commit`);
    expect(r.out).not.toMatch(/^\s+at /m);
  });

  it('allows the holder\'s own child (its token)', () => {
    writeLock({ repo: REPO, token: 'holder-token' });
    const r = hook({ [BOX_LOCK_TOKEN_ENV]: 'holder-token' });
    expect(r.exit).toBe(0);
    expect(r.out).toContain('committing UNDER a-foreign-measurement');
  });

  it('allows a dead holder', () => {
    writeLock({ repo: REPO, pid: 2 ** 22 - 1 });
    expect(hook().exit).toBe(0);
  });

  it('allows a lock naming another tree', () => {
    writeLock({ repo: ROOT });
    const r = hook();
    expect(r.exit).toBe(0);
    expect(r.out).toBe('');
  });

  it('allows the override, and prints that it was used', () => {
    writeLock({ repo: REPO });
    const r = hook({ [COMMIT_ANYWAY_ENV]: '1' });
    expect(r.exit).toBe(0);
    expect(r.out).toContain(`${COMMIT_ANYWAY_ENV}=1 USED`);
  });

  /** ⛓ …and git really invokes it through core.hooksPath. */
  it('stops a real `git commit` in the locked tree, and not in another', () => {
    const repo = join(ROOT, 'repo');
    mkdirSync(repo);
    const git = (args, env = {}) => spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t',
      '-c', `core.hooksPath=${HERE}`, ...args], {
      cwd: repo, encoding: 'utf8',
      env: { ...process.env, XDG_CACHE_HOME: CACHE, [BOX_LOCK_TOKEN_ENV]: '', [COMMIT_ANYWAY_ENV]: '', ...env },
    });
    execFileSync('git', ['init', '-q'], { cwd: repo });
    writeLock({ repo });
    const refused = git(['commit', '--allow-empty', '-q', '-m', 'under a foreign lock']);
    expect(refused.status).not.toBe(0);
    expect(`${refused.stdout}${refused.stderr}`).toContain('⛔ COMMIT REFUSED');
    writeLock({ repo: REPO });
    expect(git(['commit', '--allow-empty', '-q', '-m', 'lock is elsewhere']).status).toBe(0);
  });
});
