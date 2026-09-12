/**
 * Guards for scripts/test/testServer.js — the ONE place the browser tests'
 * dev-server address comes from.
 *
 * The rows that matter are the ones a re-hardcoding would red: the census
 * over every file that used to spell the port (a literal host:port or server
 * command anywhere in the population is a regression, whatever the default
 * happens to be), and the two child-process rows that import the
 * real config / the real Python helper under `TEST_PORT=8123` — a row that
 * only read the default could not tell "derived" from "hardcoded" (the port
 * would agree either way).
 */
import { describe, it, expect } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_TEST_PORT, resolveTestPort } from './testServer.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const PROBE_PORT = '8123';

describe('resolveTestPort', () => {
  it('unset or empty TEST_PORT is the default', () => {
    expect(resolveTestPort({})).toBe(DEFAULT_TEST_PORT);
    expect(resolveTestPort({ TEST_PORT: '' })).toBe(DEFAULT_TEST_PORT);
  });
  it('an integer TEST_PORT is honoured as a number', () => {
    expect(resolveTestPort({ TEST_PORT: PROBE_PORT })).toBe(Number(PROBE_PORT));
  });
  it('a non-port TEST_PORT is refused by name, never silently defaulted', () => {
    for (const bad of ['abc', '80a', '0', '65536', '-1', '8000.5']) {
      expect(() => resolveTestPort({ TEST_PORT: bad }), bad).toThrow(/TEST_PORT/);
    }
  });
});

describe('every entry point derives the address from TEST_PORT', () => {
  it('playwright.config.js: webServer url + command follow TEST_PORT (child process, env set)', () => {
    const out = execFileSync(process.execPath, [
      '--input-type=module', '-e',
      'import c from "./playwright.config.js"; console.log(JSON.stringify([c.webServer.url, c.webServer.command]))',
    ], { cwd: ROOT, env: { ...process.env, TEST_PORT: PROBE_PORT }, encoding: 'utf8' });
    expect(JSON.parse(out.trim())).toEqual([
      `http://localhost:${PROBE_PORT}`,
      `python -m http.server ${PROBE_PORT}`,
    ]);
  });

  it('scripts/lib/test_utils.py: test_port / test_base_url / http_server_command follow TEST_PORT', () => {
    const out = execFileSync('python3', ['-c', [
      'import sys; sys.path.insert(0, "scripts")',
      'from lib.test_utils import test_port, test_base_url, http_server_command',
      'import json; print(json.dumps([test_port(), test_base_url(), http_server_command()[1:]]))',
    ].join('\n')], { cwd: ROOT, env: { ...process.env, TEST_PORT: PROBE_PORT }, encoding: 'utf8' });
    expect(JSON.parse(out.trim())).toEqual([
      Number(PROBE_PORT), `http://localhost:${PROBE_PORT}`, ['-m', 'http.server', PROBE_PORT],
    ]);
  });

  it('scripts/lib/test_utils.py: a non-port TEST_PORT exits non-zero naming the variable', () => {
    const r = spawnSync('python3', ['-c', 'import sys; sys.path.insert(0, "scripts"); from lib.test_utils import test_port; test_port()'],
      { cwd: ROOT, env: { ...process.env, TEST_PORT: 'abc' }, encoding: 'utf8' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/TEST_PORT/);
  });

  it('run-tests.js: --port=NNNN reaches the spawned playwright as TEST_PORT (a shim on PATH stands in for it)', () => {
    const shimDir = mkdtempSync(path.join(tmpdir(), 'pw-shim-'));
    writeFileSync(path.join(shimDir, 'playwright'), '#!/bin/sh\necho "SHIM TEST_PORT=$TEST_PORT"\n', { mode: 0o755 });
    const r = spawnSync(process.execPath, ['scripts/test/run-tests.js', `--port=${PROBE_PORT}`],
      { cwd: ROOT, env: { ...process.env, TEST_PORT: '', PATH: `${shimDir}${path.delimiter}${process.env.PATH}` }, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain(`SHIM TEST_PORT=${PROBE_PORT}`);
  });

  it('run-tests.js: --port=<not a port> exits 2 before anything is spawned', () => {
    const r = spawnSync(process.execPath, ['scripts/test/run-tests.js', '--port=abc'],
      { cwd: ROOT, env: { ...process.env, TEST_PORT: '' }, encoding: 'utf8' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/TEST_PORT/);
  });
});

describe('the census: no entry point spells the port any more', () => {
  // The population is DERIVED (every JS/Python file under the test harness
  // directories + the Playwright config), never a hand list — a new spec
  // that hardcodes the port joins the population by existing.
  const files = [
    path.join(ROOT, 'playwright.config.js'),
    ...readdirSync(path.join(ROOT, 'test_json', 'e2e')).filter(f => f.endsWith('.js')).map(f => path.join(ROOT, 'test_json', 'e2e', f)),
    // This guard is the one file allowed to spell the pattern it hunts.
    ...readdirSync(path.join(ROOT, 'scripts', 'test')).filter(f => /\.(m?js|py)$/.test(f) && f !== path.basename(fileURLToPath(import.meta.url))).map(f => path.join(ROOT, 'scripts', 'test', f)),
    path.join(ROOT, 'scripts', 'lib', 'test_utils.py'),
  ];
  const LITERAL = /localhost:8000|http\.server['", ]+8000|['"]8000['"]/;

  it('the population is non-trivial', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map(f => [path.relative(ROOT, f)]))('%s carries no literal port', (rel) => {
    const offending = readFileSync(path.join(ROOT, rel), 'utf8').split('\n')
      .map((line, i) => [i + 1, line]).filter(([, line]) => LITERAL.test(line));
    expect(offending, `${rel} — the port comes from TEST_PORT (scripts/test/testServer.js / test_utils.test_port)`).toEqual([]);
  });
});
