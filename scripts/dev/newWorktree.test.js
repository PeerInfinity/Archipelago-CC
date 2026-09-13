/**
 * scripts/dev/new-worktree.sh — its `--dry-run` plan, proven against a temp
 * parent directory (BOX PROTOCOL P0). The live run is the planner's; these
 * rows prove the plan is the recipe and that the script creates nothing when
 * asked for a plan.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SCRIPT = join(HERE, 'new-worktree.sh');
const git = (args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8' }).trim();
const FAMILY = basename(dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir'])));
const SUBMODULES = git(['config', '--file', '.gitmodules', '--get-regexp', '^submodule\\..*\\.path$'])
  .split('\n').map((l) => l.split(' ')[1]);
const WASM = readFileSync(SCRIPT, 'utf8').match(/^WASM_SUBMODULE="([^"]+)"/m)[1];

let PARENT;
/**
 * ⛔ The plan must not depend on THIS clone's config. The script refuses unless
 * `extensions.worktreeConfig` is on (without it `core.hooksPath` cannot be set
 * for one worktree) — the box's clone has it and CI's checkout does not, which
 * is how these rows first went red in CI and nowhere else. So a row states the
 * config it runs under, through git's own GIT_CONFIG_* environment.
 */
const ROW_EMAIL = 'p0-row@example.invalid';
const withWorktreeConfig = (value) => ({
  GIT_CONFIG_COUNT: '3',
  GIT_CONFIG_KEY_0: 'extensions.worktreeConfig', GIT_CONFIG_VALUE_0: value,
  /* …and the identity the plan copies into submodules: CI's checkout has none */
  GIT_CONFIG_KEY_1: 'user.name', GIT_CONFIG_VALUE_1: 'p0-row',
  GIT_CONFIG_KEY_2: 'user.email', GIT_CONFIG_VALUE_2: ROW_EMAIL,
});
const run = (args, env = withWorktreeConfig('true')) => {
  const r = spawnSync('bash', [SCRIPT, ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, NEW_WORKTREE_PARENT: PARENT, ...env },
  });
  return { exit: r.status, out: r.stdout, err: r.stderr };
};
const planLine = (out, re) => out.split('\n').filter((l) => l.startsWith('+ ') && re.test(l));

beforeAll(() => { PARENT = mkdtempSync(join(tmpdir(), 'p0-newwt-')); });
afterAll(() => { rmSync(PARENT, { recursive: true, force: true }); });

describe('new-worktree.sh --dry-run', () => {
  it('plans the whole recipe under the parent, and creates nothing', () => {
    const r = run(['--dry-run', 'p0-row-probe', 'HEAD']);
    expect(r.exit).toBe(0);
    const dest = join(PARENT, `${FAMILY}-wt-p0-row-probe`);
    expect(planLine(r.out, /worktree add/)).toEqual([`+ git -C ${REPO} worktree add -b p0-row-probe ${dest} HEAD`]);
    const [init] = planLine(r.out, /submodule update --init/);
    expect(init.split(' -- ')[1].split(' ')).toEqual(SUBMODULES.filter((s) => s !== WASM));
    expect(r.out).toContain(`# skipped (pass --with-wasm to include): ${WASM}`);
    /* each initialised submodule clone gets the outer identity */
    expect(planLine(r.out, /config user\.email/))
      .toEqual(SUBMODULES.filter((s) => s !== WASM).map((s) => `+ git -C ${dest}/${s} config user.email ${ROW_EMAIL}`));
    expect(planLine(r.out, /npm ci/)).toEqual([`+ npm ci --prefix ${dest}`]);
    expect(planLine(r.out, /hooksPath/)).toEqual([`+ git -C ${dest} config --worktree core.hooksPath scripts/git-hooks`]);
    /* no fetch for a local base */
    expect(planLine(r.out, /fetch/)).toEqual([]);
    /* the two lines a slice needs, on ONE port */
    const serve = r.out.match(/python -m http\.server (\d+)/);
    const test = r.out.match(/npm test -- --port=(\d+)/);
    expect(serve && test && serve[1] === test[1]).toBe(true);
    expect(existsSync(dest)).toBe(false);
    expect(git(['branch', '--list', 'p0-row-probe'])).toBe('');
  });

  it('includes the wasm submodule only with --with-wasm, and fetches for an origin/ base', () => {
    /* a ref no clone has, so the box and a CI checkout take the same path */
    const r = run(['--dry-run', '--with-wasm', 'p0-row-probe', 'origin/p0-row-never-fetched']);
    expect(r.exit).toBe(0);
    expect(r.out).toContain('is not fetched here (a dry run does not fetch)');
    const [init] = planLine(r.out, /submodule update --init/);
    expect(init.split(' -- ')[1].split(' ')).toEqual(SUBMODULES);
    expect(planLine(r.out, /fetch origin/)).toEqual([`+ git -C ${REPO} fetch origin`]);
  });

  it('refuses by name: an existing destination, a bad branch name, an unknown option', () => {
    mkdirSync(join(PARENT, `${FAMILY}-wt-taken`));
    const taken = run(['--dry-run', 'taken', 'HEAD']);
    expect(taken.exit).toBe(1);
    expect(taken.err).toMatch(/already exists — this script only creates/);
    const bad = run(['--dry-run', 'no..dots', 'HEAD']);
    expect(bad.exit).toBe(1);
    expect(bad.err).toMatch(/not a valid branch name/);
    expect(run(['--nope', 'x']).exit).toBe(2);
    const noExt = run(['--dry-run', 'p0-row-probe', 'HEAD'], withWorktreeConfig('false'));
    expect(noExt.exit).toBe(1);
    expect(noExt.err).toMatch(/extensions\.worktreeConfig is not enabled/);
    const local = run(['--dry-run', 'p0-row-probe', 'no-such-local-ref']);
    expect(local.exit).toBe(1);
    expect(local.err).toMatch(/is not a commit/);
  });

  /**
   * ⛓ WT1 — step 6, the getting-started guide's steps 3 and 4 in the worktree,
   * so the Generate.py gates run there (plan §19). ⛔ The preset is read back
   * out of `update_host_settings.py`'s PRESETS, so a renamed preset reds here.
   */
  const STEP6 = (dest) => [
    `+ PY=$(cd ${dest} && node scripts/procgen/repoPython.js --generate)`,
    `+ (cd ${dest} && $PY -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')")`,
    `+ (cd ${dest} && $PY Launcher.py --update_settings)`,
    `+ (cd ${dest} && $PY scripts/setup/update_host_settings.py full-spoilers)`,
  ];

  it('step 6: the ladder asked, then the three provisioning commands, in order, after npm ci', () => {
    const r = run(['--dry-run', 'p0-row-probe', 'HEAD']);
    expect(r.exit).toBe(0);
    const dest = join(PARENT, `${FAMILY}-wt-p0-row-probe`);
    const plan = r.out.split('\n').filter((l) => l.startsWith('+ '));
    const npm = plan.findIndex((l) => /npm ci/.test(l));
    /* step 6 closes the plan: nothing from steps 1–5 comes after it */
    expect(plan.slice(npm + 2)).toEqual(STEP6(dest));
    const presets = readFileSync(join(REPO, 'scripts', 'setup', 'update_host_settings.py'), 'utf8');
    expect(presets).toMatch(/^PRESETS = \{[\s\S]*^ {4}'full-spoilers': \{/m);
    /* the tail: serve/test unchanged in shape, and the venv a worktree shares */
    const primary = dirname(git(['rev-parse', '--path-format=absolute', '--git-common-dir']));
    expect(r.out).toMatch(/^# serve it: {2}\(cd .* && python -m http\.server \d+\)$/m);
    expect(r.out).toMatch(/^# test it: {3}\(cd .* && npm test -- --port=\d+ …\)$/m);
    expect(r.out).toMatch(new RegExp(`^# python: {4}source ${primary}/\\.venv/bin/activate `, 'm'));
  });

  it('step 6 refused (SEEDLING_PYTHON=/bin/false): the ladder, the by-hand commands, exit 0, the worktree still planned', () => {
    const r = run(['--dry-run', 'p0-row-probe', 'HEAD'], { ...withWorktreeConfig('true'), SEEDLING_PYTHON: '/bin/false' });
    expect(r.exit).toBe(0);
    const dest = join(PARENT, `${FAMILY}-wt-p0-row-probe`);
    expect(planLine(r.out, /worktree add/)).toHaveLength(1);
    expect(r.out).toMatch(/^REFUSED: repoPython\.js --generate: .*`import Utils`.*: \/bin\/false$/m);
    for (const rung of ['SEEDLING_PYTHON', '$VIRTUAL_ENV/bin/python', '<tree>/.venv/bin/python', 'PATH python3']) {
      expect(r.out).toContain(rung);
    }
    const byHand = r.out.split('\n').filter((l) => l.startsWith(`#   (cd ${dest} && python `)).map((l) => `+ ${l.slice(4)}`);
    expect(byHand).toEqual(STEP6(dest).slice(1).map((l) => l.replace('$PY', 'python')));
    expect(r.out).toMatch(/^# serve it:/m);
  });

  it('has a --help, and no removal path anywhere in the script', () => {
    const r = run(['--help']);
    expect(r.exit).toBe(0);
    expect(r.out).toContain('--with-wasm');
    expect(r.out).toMatch(/^ {2}6\. the getting-started guide's steps 3 and 4/m);
    const src = readFileSync(SCRIPT, 'utf8');
    expect(src).not.toMatch(/\brm\b|worktree remove|rmdir|worktree prune/);
  });
});
