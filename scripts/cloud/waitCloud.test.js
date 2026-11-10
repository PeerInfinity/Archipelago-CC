// wait-cloud: real git repositories, the real CLI. Every case states what the launcher
// would be told, because a wrong answer here is a launcher that never wakes.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CLI = resolve(__dirname, 'wait-cloud.mjs');
const FAST = ['--interval=0.05', '--check-in=0.01'];

let root;
let clone;
let baseline;

function git(args, cwd = clone) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function pushCommit(branch, message) {
  git(['checkout', '-q', '-B', branch, 'origin/main']);
  git(['commit', '-q', '--allow-empty', '-m', message]);
  git(['push', '-q', '-f', 'origin', `${branch}:refs/heads/${branch}`]);
  return git(['rev-parse', 'HEAD']).trim();
}

function run(...args) {
  const out = spawnSync('node', [CLI, ...args], { cwd: clone, encoding: 'utf8' });
  return { code: out.status, stdout: out.stdout, stderr: out.stderr };
}

const snapshot = () => run('snapshot', baseline);
const waitFor = (...slices) => run('wait', `--baseline=${baseline}`, ...slices.map((s) => `--slice=${s}`), ...FAST);
const finalOf = (slice) => `work\n\nCloud-Slice: ${slice}\nCloud-Status: final\nCo-Authored-By: Claude <noreply@anthropic.com>`;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'wait-cloud-test-'));
  const remote = join(root, 'remote.git');
  clone = join(root, 'clone');
  baseline = join(root, 'baseline.json');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', remote]);
  execFileSync('git', ['clone', '-q', remote, clone], { stdio: 'ignore' });
  git(['config', 'user.name', 'test']);
  git(['config', 'user.email', 'test@example.invalid']);
  git(['checkout', '-q', '-B', 'main']);
  git(['commit', '-q', '--allow-empty', '-m', 'root']);
  git(['push', '-q', 'origin', 'main']);
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('wait-cloud', { timeout: 30_000 }, () => {
  it('wakes the launcher when the watched slice pushes its final commit', () => {
    snapshot();
    const sha = pushCommit('claude/some-title-abc123', finalOf('my-slice'));
    const { code, stdout } = waitFor('my-slice');
    expect(code).toBe(0);
    expect(stdout).toContain(`CLOUD-WAIT report slice=my-slice status=final ref=claude/some-title-abc123 sha=${sha}`);
  });

  it('matches the Cloud-Slice trailer, not the harness-chosen branch name', () => {
    snapshot();
    pushCommit('claude/unrelated-title-zzz', finalOf('my-slice'));
    expect(waitFor('my-slice').stdout).toContain('slice=my-slice status=final');
  });

  it('reports `blocked`, so a session waiting on an answer wakes its launcher', () => {
    snapshot();
    pushCommit('claude/a', 'stuck\n\nCloud-Slice: my-slice\nCloud-Status: blocked');
    const { code, stdout } = waitFor('my-slice');
    expect(code).toBe(0);
    expect(stdout).toContain('status=blocked');
  });

  it('passes an unknown status through instead of waiting forever on a typo', () => {
    snapshot();
    pushCommit('claude/a', 'done\n\nCloud-Slice: my-slice\nCloud-Status: finished');
    const { code, stdout } = waitFor('my-slice');
    expect(code).toBe(0);
    expect(stdout).toContain('status=finished');
  });

  it('stays asleep through a mid-work push and checks in at the deadline', () => {
    snapshot();
    pushCommit('claude/a', 'mid-work commit, no trailer');
    const { code, stdout } = waitFor('my-slice');
    expect(code).toBe(3);
    expect(stdout).toMatch(/CLOUD-WAIT check-in slices=my-slice minutes=\d+ moved=1 failed-polls=0/);
  });

  it('ignores another slice\'s final commit', () => {
    snapshot();
    pushCommit('claude/a', finalOf('someone-else'));
    expect(waitFor('my-slice').code).toBe(3);
  });

  it('ignores a final commit that was already there when the baseline was taken', () => {
    pushCommit('claude/old', finalOf('my-slice'));
    snapshot();
    expect(waitFor('my-slice').code).toBe(3);
  });

  it('fires for a branch from the baseline that moves to a final commit', () => {
    pushCommit('claude/a', 'mid-work');
    snapshot();
    git(['commit', '-q', '--allow-empty', '-m', finalOf('my-slice')]);
    git(['push', '-q', 'origin', 'claude/a:refs/heads/claude/a']);
    expect(waitFor('my-slice').code).toBe(0);
  });

  it('reports every slice that finished in the same poll', () => {
    snapshot();
    pushCommit('claude/a', finalOf('one'));
    pushCommit('claude/b', finalOf('two'));
    const { stdout } = waitFor('one', 'two');
    expect(stdout).toContain('slice=one status=final');
    expect(stdout).toContain('slice=two status=final');
  });

  it('wakes on a push that lands while it is already waiting', async () => {
    snapshot();
    const child = spawn('node', [CLI, 'wait', `--baseline=${baseline}`, '--slice=my-slice', '--interval=0.05', '--check-in=1'], { cwd: clone });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    const exited = new Promise((done) => child.on('exit', done));
    pushCommit('claude/late', finalOf('my-slice'));
    expect(await exited).toBe(0);
    expect(stdout).toContain('ref=claude/late');
  });

  it('leaves the working tree\'s FETCH_HEAD and refs alone', () => {
    snapshot();
    pushCommit('claude/a', finalOf('my-slice'));
    const before = git(['for-each-ref']);
    waitFor('my-slice');
    expect(git(['for-each-ref'])).toBe(before);
    expect(() => statSync(join(clone, '.git', 'FETCH_HEAD'))).toThrow();
  });

  it('keeps a heartbeat, which the hourly backstop reads', () => {
    snapshot();
    const heartbeat = join(root, 'beat');
    run('wait', `--baseline=${baseline}`, '--slice=my-slice', ...FAST, `--heartbeat=${heartbeat}`);
    expect(readFileSync(heartbeat, 'utf8')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('survives an unreachable remote and says so at the check-in', () => {
    snapshot();
    git(['remote', 'set-url', 'origin', join(root, 'gone.git')]);
    const { code, stdout, stderr } = waitFor('my-slice');
    expect(code).toBe(3);
    expect(stderr).toContain('poll failed');
    expect(stdout).toMatch(/failed-polls=[1-9]/);
  });

  it('refuses to start without a baseline or a slice', () => {
    expect(run('wait', '--slice=my-slice').code).toBe(2);
    expect(run('wait', `--baseline=${join(root, 'missing.json')}`, '--slice=x').code).toBe(2);
    snapshot();
    expect(run('wait', `--baseline=${baseline}`).code).toBe(2);
  });

  it('refuses a mistyped option rather than ignoring it', () => {
    snapshot();
    const { code, stderr } = run('wait', `--baseline=${baseline}`, '--slice=x', '--checkin=5');
    expect(code).toBe(2);
    expect(stderr).toContain('--checkin');
  });

  it('reads the last value when a message repeats a trailer', () => {
    snapshot();
    pushCommit('claude/a', 'x\n\nCloud-Status: blocked\nCloud-Slice: my-slice\nCloud-Status: final');
    expect(waitFor('my-slice').stdout).toContain('status=final');
  });

  it('does not read a trailer key from the middle of a line', () => {
    snapshot();
    pushCommit('claude/a', 'notes: see Cloud-Status: final and Cloud-Slice: my-slice in the brief');
    expect(waitFor('my-slice').code).toBe(3);
  });

  it('writes a baseline the waiter can read', () => {
    pushCommit('claude/a', 'x');
    const { stdout } = snapshot();
    expect(stdout).toContain('refs=1');
    const parsed = JSON.parse(readFileSync(baseline, 'utf8'));
    expect(Object.keys(parsed.refs)).toEqual(['refs/heads/claude/a']);
  });
});
