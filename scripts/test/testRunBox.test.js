/**
 * `npm test` takes the box — rows for scripts/test/testRunBox.js and the REAL
 * scripts/test/run-tests.js (BOX PROTOCOL P0).
 *
 * ⛔ Every runner row runs in a CHILD pointed at a temp `XDG_CACHE_HOME`
 * (boxLock.js resolves it at import), and with a FAKE `playwright` first on
 * PATH that reports what it saw — the lock file during the run, its argv, the
 * signal it got — and writes a results file the way app.spec.js does. So the
 * real runner is driven end to end without a browser, and without ever
 * touching the real `~/.cache/seedling-box/lock.json`.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import {
  chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  RESULTS_SUBDIR, WAIT_FOR_BOX_FLAG, resultsFiles, runLockName, stampResults, waitSecFrom
} from './testRunBox.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const RUNNER = join(HERE, 'run-tests.js');
const BOX_LOCK = join(REPO, 'scripts', 'procgen', 'boxLock.js');
const HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();

let ROOT;
let n = 0;

/** A fresh sandbox: its own cache, its own cwd, a fake playwright on PATH. */
function sandbox() {
  const dir = join(ROOT, `s${n++}`);
  const cache = join(dir, 'cache');
  const cwd = join(dir, 'cwd');
  const bin = join(dir, 'bin');
  for (const d of [join(cache, 'seedling-box'), cwd, bin]) mkdirSync(d, { recursive: true });
  const report = join(dir, 'playwright-saw.json');
  /* The fake reads the lock at START, then (on SIGTERM) again just before it
   * exits — which is what proves the runner released only after its child. */
  writeFileSync(join(bin, 'playwright'), `#!${process.execPath}
const fs = require('fs'); const path = require('path');
const lockFile = ${JSON.stringify(join(cache, 'seedling-box', 'lock.json'))};
const read = () => fs.existsSync(lockFile) ? JSON.parse(fs.readFileSync(lockFile, 'utf8')) : null;
const saw = { argv: process.argv.slice(2), lockAtStart: read(), pid: process.pid };
const out = path.join(process.cwd(), ${JSON.stringify(RESULTS_SUBDIR)});
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'test-results-9999-fake.json'), JSON.stringify({ mode: 'fake' }));
fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify(saw));
const holdMs = Number(process.env.FAKE_PLAYWRIGHT_HOLD_MS || 0);
if (holdMs) {
  process.on('SIGTERM', () => {
    setTimeout(() => {
      saw.signal = 'SIGTERM'; saw.lockAtExit = read();
      fs.writeFileSync(${JSON.stringify(report)}, JSON.stringify(saw));
      process.exit(0);
    }, 500);
  });
  setTimeout(() => process.exit(0), holdMs);
}
`);
  chmodSync(join(bin, 'playwright'), 0o755);
  const env = {
    ...process.env,
    XDG_CACHE_HOME: cache,
    PATH: `${bin}:${process.env.PATH}`,
    SEEDLING_BOX_LOCK_TOKEN: '',
  };
  return {
    dir, cache, cwd, env, report,
    lockFile: join(cache, 'seedling-box', 'lock.json'),
    saw: () => (existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) : null),
  };
}

/** Run the real runner to completion. */
function runRunner(sb, args, extraEnv = {}) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [RUNNER, ...args], {
    cwd: sb.cwd, encoding: 'utf8', env: { ...sb.env, ...extraEnv }, timeout: 60000,
  });
  return { exit: r.status, out: `${r.stdout}${r.stderr}`, ms: Date.now() - t0 };
}

/** A foreign holder whose pid is live: a `sleep` we own. */
function fakeHolder(sb, { repo = REPO } = {}) {
  const sleeper = spawn('sleep', ['120'], { stdio: 'ignore' });
  writeFileSync(sb.lockFile, JSON.stringify({
    token: 'foreign-token', pid: sleeper.pid, name: 'a-foreign-holder', kind: 'measure',
    repo, hostname: 'x', since: new Date().toISOString(),
    frozen: { head: 'f'.repeat(40), tracked: 'z', trackedLines: 0 },
  }));
  return sleeper;
}

const waitFor = async (pred, ms = 15000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
};

beforeAll(() => { ROOT = mkdtempSync(join(tmpdir(), 'p0-runbox-')); });
afterAll(() => {
  try { chmodSync(join(ROOT, 'ro'), 0o755); } catch { /* not made */ }
  rmSync(ROOT, { recursive: true, force: true });
});

describe('the pure helpers', () => {
  it('names the run by mode, batch and test ids', () => {
    expect(runLockName({ mode: 'test-substrates', batch: '', testIds: '' }))
      .toBe('npm test test-substrates');
    expect(runLockName({ mode: 'test-substrates', batch: 'fast', testIds: 'a,b' }))
      .toBe('npm test test-substrates batch=fast test=a,b');
  });

  it('reads --wait-for-box from argv or npm config, and refuses a non-number by name', () => {
    expect(waitSecFrom([], {})).toBe(0);
    expect(waitSecFrom([`${WAIT_FOR_BOX_FLAG}60`], {})).toBe(60);
    expect(waitSecFrom([], { npm_config_wait_for_box: '7' })).toBe(7);
    for (const bad of ['abc', '-1']) {
      expect(() => waitSecFrom([`${WAIT_FOR_BOX_FLAG}${bad}`], {})).toThrow(/wait-for-box/);
    }
  });

  it('stamps only the results files the run wrote, and says whether the tree moved', () => {
    const cwd = join(ROOT, 'stamp');
    const dir = join(cwd, RESULTS_SUBDIR);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'test-results-old.json'), '{"mode":"old"}');
    const before = resultsFiles(cwd);
    writeFileSync(join(dir, 'test-results-new.json'), '{"mode":"new"}');
    const frozen = { head: 'a'.repeat(40), tracked: 't', trackedLines: 0 };
    const moved = stampResults({ before, frozen, now: { ...frozen, head: 'b'.repeat(40) }, cwd });
    expect(moved.treeMoved).toBe(true);
    expect(moved.stamped.map((f) => f.slice(dir.length + 1))).toEqual(['test-results-new.json']);
    const stampedNew = JSON.parse(readFileSync(join(dir, 'test-results-new.json'), 'utf8'));
    expect(stampedNew).toMatchObject({ mode: 'new', frozen, treeMoved: true });
    expect(JSON.parse(readFileSync(join(dir, 'test-results-old.json'), 'utf8')))
      .toEqual({ mode: 'old' });
    /* a tracked-porcelain move at the same head is a move too */
    expect(stampResults({ before, frozen, now: { ...frozen, tracked: 'u' }, cwd }).treeMoved)
      .toBe(true);
    expect(stampResults({ before, frozen, now: frozen, cwd }).treeMoved).toBe(false);
    expect(stampResults({ before, frozen: null, now: frozen, cwd }).treeMoved).toBe(null);
  });
});

describe('the real runner and the box', () => {
  /**
   * ⛔ THE INCIDENT: a triage run started into another slice's measurement.
   * The runner must refuse BY NAME, before Playwright exists, as a sentence.
   */
  it('refuses a held box by name, exit 1, before Playwright is spawned', () => {
    const sb = sandbox();
    const holder = fakeHolder(sb);
    try {
      const r = runRunner(sb, ['--mode=test-substrates', '--test=some-row']);
      expect(r.exit).toBe(1);
      expect(r.out).toContain('⛔ THE BOX IS TAKEN');
      expect(r.out).toContain('npm test test-substrates test=some-row (browser) refuses');
      expect(r.out).toMatch(/holder\s+a-foreign-holder \(measure\)/);
      expect(r.out).not.toContain('at takeBoxLock');
      expect(sb.saw()).toBe(null);
    } finally { holder.kill(); }
  });

  it('takes the box for the run, names it, releases it, and stamps the head it froze', () => {
    const sb = sandbox();
    const r = runRunner(sb, ['--mode=test-substrates', '--batch=fast', `${WAIT_FOR_BOX_FLAG}5`]);
    expect(r.exit).toBe(0);
    const saw = sb.saw();
    expect(saw.lockAtStart).toMatchObject({ name: 'npm test test-substrates batch=fast',
      kind: 'browser', repo: REPO });
    expect(saw.lockAtStart.frozen.head).toBe(HEAD);
    /* the queue flag is the runner's, never Playwright's */
    expect(saw.argv.some((a) => a.startsWith(WAIT_FOR_BOX_FLAG))).toBe(false);
    expect(existsSync(sb.lockFile)).toBe(false);
    const [results] = resultsFiles(sb.cwd);
    const stamped = JSON.parse(readFileSync(results, 'utf8'));
    expect(stamped.frozen.head).toBe(HEAD);
    expect(typeof stamped.treeMoved).toBe('boolean');
  });

  /**
   * ⛓ RULE 3: a run UNDER a holder (a wrapper that took the box, or the Python
   * drivers under `gates.mjs`) is the holder's child, not a second taker.
   */
  it('passes through under a holder that exported its token', () => {
    const sb = sandbox();
    const script = join(sb.dir, 'holder.mjs');
    writeFileSync(script, `
import { takeBoxLock } from ${JSON.stringify(BOX_LOCK)};
import { spawnSync } from 'node:child_process';
takeBoxLock({ name: 'the-wrapper', kind: 'browser', repo: ${JSON.stringify(REPO)} });
const r = spawnSync(process.execPath, [${JSON.stringify(RUNNER)}, '--mode=test-substrates'],
  { cwd: ${JSON.stringify(sb.cwd)}, encoding: 'utf8', env: process.env });
console.log(r.stdout + r.stderr); console.log('RUNNER-EXIT=' + r.status);
`);
    const r = spawnSync(process.execPath, [script], { encoding: 'utf8', env: sb.env });
    const out = `${r.stdout}${r.stderr}`;
    expect(out).toContain('RUNNER-EXIT=0');
    expect(out).toMatch(/npm test test-substrates runs UNDER the-wrapper \(pid \d+\)/);
    expect(sb.saw().lockAtStart.name).toBe('the-wrapper');
    expect(existsSync(sb.lockFile)).toBe(false);
  });

  it('queues with --wait-for-box and runs once the holder is gone', async () => {
    const sb = sandbox();
    const holder = fakeHolder(sb);
    const child = spawn(process.execPath, [RUNNER, '--mode=test-substrates', `${WAIT_FOR_BOX_FLAG}30`],
      { cwd: sb.cwd, env: sb.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    const exited = new Promise((res) => child.on('exit', res));
    expect(await waitFor(() => out.includes('BUSY'))).toBe(true);
    expect(sb.saw()).toBe(null);
    holder.kill();
    expect(await exited).toBe(0);
    expect(out).toContain('TAKEN by npm test test-substrates');
    expect(sb.saw().lockAtStart.name).toBe('npm test test-substrates');
  });

  /**
   * ⛔⛔ TRAP 1338 — a SIGTERM'd QUEUED run must die, not live on to take the
   * box once the holder goes and then run its payload.
   */
  it('dies promptly on SIGTERM while queued, and never runs', async () => {
    const sb = sandbox();
    const holder = fakeHolder(sb);
    try {
      const child = spawn(process.execPath, [RUNNER, '--mode=test-substrates', `${WAIT_FOR_BOX_FLAG}60`],
        { cwd: sb.cwd, env: sb.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      const exited = new Promise((res) => child.on('exit', (code, sig) => res({ code, sig })));
      expect(await waitFor(() => out.includes('BUSY'))).toBe(true);
      const t0 = Date.now();
      child.kill('SIGTERM');
      const end = await Promise.race([exited, new Promise((res) => setTimeout(() => res('ALIVE'), 5000))]);
      expect(end).not.toBe('ALIVE');
      expect(Date.now() - t0).toBeLessThan(5000);
      holder.kill();
      await new Promise((r) => setTimeout(r, 2500));
      expect(sb.saw()).toBe(null);
    } finally { holder.kill(); }
  });

  /**
   * ⛔⛔ TRAP 1334's SHAPE — killing `npm` leaves `node run-tests.js` queued and
   * reparented (measured, npm 10.8.2). A queued run whose parent is gone stops
   * queuing and takes nothing. The parent here is a shell that exits.
   */
  it('stops queuing when the process that started it is gone, and never runs', async () => {
    const sb = sandbox();
    const holder = fakeHolder(sb);
    const log = join(sb.dir, 'orphan.log');
    const pidFile = join(sb.dir, 'orphan.pid');
    try {
      spawnSync('bash', ['-c', `"${process.execPath}" "${RUNNER}" --mode=test-substrates `
        + `${WAIT_FOR_BOX_FLAG}60 > "${log}" 2>&1 & echo $! > "${pidFile}"; `
        + `for i in $(seq 1 50); do grep -q BUSY "${log}" && break; sleep 0.1; done; exit 0`],
      { cwd: sb.cwd, env: sb.env });
      const pid = Number(readFileSync(pidFile, 'utf8'));
      const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
      expect(await waitFor(() => !alive(), 8000)).toBe(true);
      expect(readFileSync(log, 'utf8')).toMatch(/STOPS QUEUING — the process that started it is gone/);
      holder.kill();
      await new Promise((r) => setTimeout(r, 2500));
      expect(sb.saw()).toBe(null);
    } finally { holder.kill(); }
  });

  /**
   * ⛓ A killed run forwards the signal and releases only once Playwright is
   * gone — the fake reads the lock as it exits, 0.5 s after its SIGTERM.
   */
  it('forwards SIGTERM to Playwright and releases the box only after it exits', async () => {
    const sb = sandbox();
    const child = spawn(process.execPath, [RUNNER, '--mode=test-substrates'],
      { cwd: sb.cwd, env: { ...sb.env, FAKE_PLAYWRIGHT_HOLD_MS: '30000' }, stdio: 'ignore' });
    const exited = new Promise((res) => child.on('exit', res));
    expect(await waitFor(() => sb.saw() !== null)).toBe(true);
    child.kill('SIGTERM');
    await exited;
    const saw = sb.saw();
    expect(saw.signal).toBe('SIGTERM');
    expect(saw.lockAtExit?.name).toBe('npm test test-substrates');
    expect(existsSync(sb.lockFile)).toBe(false);
  });

  /**
   * ⛓ CI: nothing contends on a runner, so a cache the lock cannot be written
   * into must not fail the run — it runs, and says it ran without the lock.
   */
  /* root writes through a 0555 directory, so the instrument would not discriminate */
  it.skipIf(process.getuid?.() === 0)('runs WITHOUT the lock, saying so, when the cache is unwritable', () => {
    const sb = sandbox();
    const ro = join(ROOT, 'ro');
    mkdirSync(ro, { recursive: true });
    chmodSync(ro, 0o555);
    const r = runRunner(sb, ['--mode=test-substrates'], { XDG_CACHE_HOME: ro });
    expect(r.exit).toBe(0);
    expect(r.out).toMatch(/# box lock: UNAVAILABLE \(EACCES/);
    expect(sb.saw()).not.toBe(null);
  });
});

describe('compare-runs reads the stamp', () => {
  it('warns about a run whose tree moved, and stays quiet about one that did not', () => {
    const dir = join(ROOT, 'compare');
    mkdirSync(dir, { recursive: true });
    const run = (name, stamp) => {
      const file = join(dir, name);
      writeFileSync(file, JSON.stringify({ mode: 'm', summary: {}, testDetails: [], ...stamp }));
      return file;
    };
    const frozen = { head: 'c'.repeat(40), tracked: 't', trackedLines: 0 };
    const quiet = run('test-results-1.json', { frozen, treeMoved: false });
    const moved = run('test-results-2.json', { frozen, treeMoved: true });
    const compare = (a, b) => spawnSync(process.execPath,
      [join(HERE, 'compare-runs.js'), a, b], { encoding: 'utf8' }).stdout;
    const loud = compare(quiet, moved);
    expect(loud).toContain('WARNING: THE TREE MOVED UNDER test-results-2.json (frozen head cccccccccc)');
    expect(loud).toContain('⚠ TREE MOVED');
    expect(compare(quiet, quiet)).not.toContain('TREE MOVED');
  });
});
