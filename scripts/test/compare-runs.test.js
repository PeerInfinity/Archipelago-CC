/**
 * compare-runs.js — the flavour stamp. A bundled run and an unbundled one boot
 * in a different order (trap 1426), so the tool must never diff one against the
 * other: explicitly named files are REFUSED (exit 2), the automatic baseline
 * only ever picks the same flavour, and `--list` names the flavour.
 *
 * The CLI reads `test-results/in-app-tests/` under its cwd, so each row runs it
 * in a child process whose cwd is a temp tree of fixture runs.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compare-runs.js');
let cwd;
let dir;

function run(name, { flavour, status = 'passed' } = {}) {
  const body = {
    mode: 'test-regression', batch: null, testIds: null,
    ...(flavour ? { flavour } : {}),
    summary: { totalRun: 1, passedCount: status === 'passed' ? 1 : 0 },
    testDetails: [{ id: 'row-a', status, durationMs: 100, conditions: [] }],
  };
  writeFileSync(path.join(dir, `test-results-${name}.json`), JSON.stringify(body));
  return path.join(dir, `test-results-${name}.json`);
}

function cli(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { exit: r.status, out: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  cwd = mkdtempSync(path.join(tmpdir(), 'compare-runs-'));
  dir = path.join(cwd, 'test-results', 'in-app-tests');
  mkdirSync(dir, { recursive: true });
});
afterEach(() => rmSync(cwd, { recursive: true, force: true }));

describe('compare-runs flavour', () => {
  it('REFUSES two explicitly named runs of different flavours', () => {
    const a = run('2026-01-01T00-00-01', { flavour: 'unbundled' });
    const b = run('2026-01-01T00-00-02', { flavour: 'bundled', status: 'failed' });
    const r = cli(a, b);
    expect(r.exit).toBe(2);
    expect(r.out).toContain('is an unbundled run and');
    expect(r.out).toContain('is a bundled run — a difference between flavours is not a regression');
    expect(r.out).not.toContain('NEW FAILURES');
  });

  it('reads an unstamped run as unbundled — the only boot the harness could drive then', () => {
    const a = run('2026-01-01T00-00-01');
    const b = run('2026-01-01T00-00-02', { flavour: 'unbundled' });
    expect(cli(a, b).exit).toBe(0);
    expect(cli(a, run('2026-01-01T00-00-03', { flavour: 'bundled' })).exit).toBe(2);
  });

  it('the automatic baseline skips a newer run of the other flavour', () => {
    run('2026-01-01T00-00-01', { flavour: 'bundled' });
    run('2026-01-01T00-00-02', { flavour: 'unbundled' });
    run('2026-01-01T00-00-03', { flavour: 'bundled' });
    const r = cli();
    expect(r.exit).toBe(0);
    expect(r.out).toContain('previous: [test-regression --bundled] test-results-2026-01-01T00-00-01.json');
  });

  it('refuses rather than guessing when only the other flavour is on disk', () => {
    run('2026-01-01T00-00-01', { flavour: 'unbundled' });
    run('2026-01-01T00-00-02', { flavour: 'bundled' });
    const r = cli();
    expect(r.exit).toBe(2);
    expect(r.out).toContain('No earlier bundled run of "test-regression --bundled"');
  });

  it('--list names the flavour of each run', () => {
    run('2026-01-01T00-00-01', { flavour: 'unbundled' });
    run('2026-01-01T00-00-02', { flavour: 'bundled' });
    const r = cli('--list');
    expect(r.out).toContain('[test-regression] test-results-2026-01-01T00-00-01.json');
    expect(r.out).toContain('[test-regression --bundled] test-results-2026-01-01T00-00-02.json');
  });
});
