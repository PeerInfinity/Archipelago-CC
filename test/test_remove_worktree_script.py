"""scripts/dev/remove-worktree.py, proven against throwaway repositories.

Every test builds its own sandbox under pytest's tmp_path: a bare "origin"
(the fork), a primary clone whose origin/main carries a copy of the script
(so the self-integrity check passes for the copy under test), worktrees,
local branches and fork refs. Nothing outside tmp_path is read or changed:
XDG_CACHE_HOME (the log and the box lock) points into the sandbox, and `gh`
is a stub on PATH.

Linux only. The script reads /proc/<pid>/cwd and `ss -ltnp` and refuses to
run anywhere else, so on Windows and macOS this module is skipped.

REMOVE_WORKTREE_SCRIPT (test-side only) points the sandbox at another copy of
the script. The mutant runs use it. The script itself has no override.
"""
import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import time

import pytest

pytestmark = pytest.mark.skipif(
    not sys.platform.startswith('linux') or shutil.which('ss') is None,
    reason='remove-worktree.py is Linux-only (/proc/<pid>/cwd, ss -ltnp) and refuses elsewhere')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.environ.get('REMOVE_WORKTREE_SCRIPT') or os.path.join(ROOT, 'scripts', 'dev', 'remove-worktree.py')
REL = 'scripts/dev/remove-worktree.py'
REAL_GIT = shutil.which('git')


class Sandbox:
    def __init__(self, tmp):
        self.tmp = str(tmp)
        self.bin = os.path.join(self.tmp, 'bin')
        os.makedirs(self.bin)
        self.env = {
            **os.environ,
            'GIT_AUTHOR_NAME': 't', 'GIT_AUTHOR_EMAIL': 't@example.invalid',
            'GIT_COMMITTER_NAME': 't', 'GIT_COMMITTER_EMAIL': 't@example.invalid',
            'GIT_CONFIG_COUNT': '2',
            'GIT_CONFIG_KEY_0': 'protocol.file.allow', 'GIT_CONFIG_VALUE_0': 'always',
            'GIT_CONFIG_KEY_1': 'init.defaultBranch', 'GIT_CONFIG_VALUE_1': 'main',
            'XDG_CACHE_HOME': os.path.join(self.tmp, 'cache'),
            'PATH': self.bin + os.pathsep + os.environ.get('PATH', ''),
            'GH_STUB_JSON': '[]',
        }
        self.env.pop('SEEDLING_BOX_LOCK_TOKEN', None)
        self._write_exe('gh', '#!/bin/sh\n'
                        'echo "$@" >> "$XDG_CACHE_HOME/gh-calls"\n'
                        '[ -n "$GH_STUB_RC" ] && { echo "stub gh failure" >&2; exit "$GH_STUB_RC"; }\n'
                        'printf "%s" "$GH_STUB_JSON"\n')
        self._write_exe('git', f'#!/bin/bash\nR={REAL_GIT}\n'
                        # branch -d <n>: move <n> first (the -d -> re-measure -> -D trip)
                        'if [ "$1" = branch ] && [ "$2" = -d ] && [ "$3" = "$WRAP_MOVE_REF" ]; then\n'
                        '  "$R" update-ref "refs/heads/$3" "$WRAP_MOVE_REF_TO"; fi\n'
                        # push ... --delete <n>: move the fork ref first (the lease trip)
                        'if [ "$1" = push ] && [ -n "$WRAP_MOVE_FORK_TO" ]; then\n'
                        '  for a; do last=$a; done\n'
                        '  "$R" push -q -f origin "$WRAP_MOVE_FORK_TO:refs/heads/$last"; fi\n'
                        'exec "$R" "$@"\n')
        self.procs = []
        self.origin = os.path.join(self.tmp, 'origin.git')
        self.primary = os.path.join(self.tmp, 'primary')
        self.git('init', '-q', '--bare', self.origin, cwd=self.tmp)
        self.git('clone', '-q', self.origin, self.primary, cwd=self.tmp)
        self.commit('base')
        os.makedirs(os.path.join(self.primary, 'scripts', 'dev'))
        shutil.copyfile(SCRIPT, os.path.join(self.primary, REL))
        self.git('add', REL)
        self.git('commit', '-q', '-m', 'the script')
        self.git('push', '-q', 'origin', 'HEAD:main')
        self.git('fetch', '-q', 'origin')
        self.git('branch', '-q', '--set-upstream-to=origin/main')

    def _write_exe(self, name, body):
        p = os.path.join(self.bin, name)
        with open(p, 'w') as f:
            f.write(body)
        os.chmod(p, 0o755)

    def git(self, *a, cwd=None, check=True):
        p = subprocess.run([REAL_GIT, *a], cwd=cwd or self.primary, env=self.env,
                           capture_output=True, text=True)
        if check and p.returncode:
            raise AssertionError(f'git {a} failed: {p.stderr}')
        return p.stdout.strip()

    def commit(self, msg, cwd=None, file=None):
        cwd = cwd or self.primary
        with open(os.path.join(cwd, file or (msg.replace(' ', '_') + '.txt')), 'w') as f:
            f.write(msg + '\n')
        self.git('add', '-A', cwd=cwd)
        self.git('commit', '-q', '-m', msg, cwd=cwd)
        return self.git('rev-parse', 'HEAD', cwd=cwd)

    def merged_branch(self, name, push=True):
        """A branch with one commit that main then fast-forwards over (ancestor)."""
        self.git('checkout', '-q', '-b', name)
        sha = self.commit(f'work on {name}')
        self.git('checkout', '-q', 'main')
        self.git('merge', '-q', '--ff-only', name)
        self.git('push', '-q', 'origin', 'main')
        if push:
            self.git('push', '-q', 'origin', name)
        return sha

    def tree(self, name, branch=None):
        path = os.path.join(self.tmp, f'wt-{name}')
        self.git('worktree', 'add', '-q', path, branch or name)
        return os.path.realpath(path)

    def manifest(self, items, name='round.approved.json'):
        p = os.path.join(self.tmp, name)
        with open(p, 'w') as f:
            json.dump({'schema': 1, 'items': items}, f, indent=1)
        return p

    def run(self, manifest, *args, go=False, sha=True, env=None):
        cmd = [sys.executable, os.path.join(self.primary, REL), manifest]
        if go:
            cmd.append('--go')
            if sha is True:
                cmd.append('--manifest-sha256=' + hashlib.sha256(open(manifest, 'rb').read()).hexdigest())
            elif sha:
                cmd.append('--manifest-sha256=' + sha)
        cmd += list(args)
        p = subprocess.run(cmd, cwd=self.tmp, env={**self.env, **(env or {})},
                           capture_output=True, text=True)
        return p.returncode, p.stdout + p.stderr

    def state(self):
        return (self.git('worktree', 'list', '--porcelain'),
                self.git('for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
                self.git('ls-remote', 'origin', 'refs/heads/*'))

    def local(self, n):
        return self.git('rev-parse', '--verify', '-q', 'refs/heads/' + n, check=False)

    def fork(self, n):
        return self.git('ls-remote', 'origin', 'refs/heads/' + n)

    def spawn(self, args, cwd):
        p = subprocess.Popen(args, cwd=cwd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        self.procs.append(p)
        return p

    def close(self):
        for p in self.procs:
            p.kill()
            p.wait()


@pytest.fixture
def sb(tmp_path):
    s = Sandbox(tmp_path)
    yield s
    s.close()


def T(path, sha, merge='ancestor', dirt=(), group='WA', **kw):
    return {'kind': 'tree', 'path': path, 'sha': sha, 'merge': merge, 'dirt': list(dirt),
            'group': group, 'ruling': '"WA: 19 finished trees (Recommended)"', **kw}


def B(kind, ref, sha, merge='ancestor', group='BM', **kw):
    return {'kind': kind, 'ref': ref, 'sha': sha, 'merge': merge, 'group': group,
            'ruling': '"WD + BM (Recommended)"', **kw}


def full_set(sb, name):
    """A finished slice: merged branch, its tree, its fork ref. Returns (sha, path, items)."""
    sha = sb.merged_branch(name)
    path = sb.tree(name)
    return sha, path, [T(path, sha), B('local', name, sha), B('fork', name, sha)]


def gone(sb, name, path):
    return not os.path.exists(path) and not sb.local(name) and not sb.fork(name)


def intact(sb, name, path):
    return os.path.isdir(path) and sb.local(name) and sb.fork(name)


# ── the dry run, GO, and the untouched ──────────────────────────────────

def test_dry_run_changes_nothing_and_prints_the_go_line(sb):
    sha, path, items = full_set(sb, 'a')
    m = sb.manifest(items)
    before = sb.state()
    rc, out = sb.run(m)
    assert rc == 0, out
    assert sb.state() == before
    assert f'OK tree {path} @ {sha[:10]}' in out
    assert 'OK local a ' in out and 'OK fork a ' in out
    digest = hashlib.sha256(open(m, 'rb').read()).hexdigest()
    assert f'sha256 {digest}' in out
    assert f'--go --manifest-sha256={digest} ' in out
    assert 'DONE' not in out


def test_go_removes_exactly_the_items_and_nothing_else(sb):
    sha, path, items = full_set(sb, 'a')
    keep_sha, keep_path, _ = full_set(sb, 'keep')   # not in the manifest
    m = sb.manifest(items)
    rc, out = sb.run(m, go=True)
    assert rc == 0, out
    assert gone(sb, 'a', path)
    assert intact(sb, 'keep', keep_path)
    assert sb.local('keep') == keep_sha
    assert 'summary GO: 3 items; 0 SKIP []; 0 FAILED []' in out


def test_go_discards_only_the_allowed_dirt(sb):
    sha = sb.merged_branch('d')
    path = sb.tree('d')
    open(os.path.join(path, 'zzProbe.txt'), 'w').write('throwaway\n')
    rc, out = sb.run(sb.manifest([T(path, sha, dirt=['?? zzProbe.txt'], group='WD')]), go=True)
    assert rc == 0, out
    assert not os.path.exists(path)
    assert "discarding with" in out and '?? zzProbe.txt' in out


def test_log_goes_to_the_fixed_place(sb):
    sha, path, items = full_set(sb, 'a')
    m = sb.manifest(items, name='round-7.approved.json')
    sb.run(m)
    logs = os.listdir(os.path.join(sb.env['XDG_CACHE_HOME'], 'worktree-cleanup'))
    assert len(logs) == 1 and logs[0].startswith('round-7.approved-') and logs[0].endswith('Z.log')


# ── every re-measure trip is a SKIP, and the run goes on ────────────────

def other_item(sb):
    """An unrelated merged local branch in the same manifest: it must still be deleted."""
    sha = sb.merged_branch('other', push=False)
    return B('local', 'other', sha)


def assert_skip_and_continue(sb, items, label, reason, rc_out):
    rc, out = rc_out
    assert rc == 1, out
    assert f'SKIP {label}: ' in out, out
    line = next(l for l in out.splitlines() if l.startswith(f'SKIP {label}: '))
    assert reason in line, line
    assert not sb.local('other'), out
    assert f'1 SKIP [\'{label}\']' in out


def test_trip_moved_tree_head(sb):
    sha = sb.merged_branch('a')
    path = sb.tree('a')
    sb.commit('later work', cwd=path)
    items = [T(path, sha), other_item(sb)]
    assert_skip_and_continue(sb, items, f'tree {path}', 'HEAD ', sb.run(sb.manifest(items), go=True))
    assert os.path.isdir(path)


def test_trip_new_dirt(sb):
    sha = sb.merged_branch('a')
    path = sb.tree('a')
    open(os.path.join(path, 'new.txt'), 'w').write('x')
    items = [T(path, sha), other_item(sb)]
    assert_skip_and_continue(sb, items, f'tree {path}', 'status', sb.run(sb.manifest(items), go=True))
    assert os.path.exists(os.path.join(path, 'new.txt'))


def test_trip_process_cwd_in_tree(sb):
    sha = sb.merged_branch('a')
    path = sb.tree('a')
    os.makedirs(os.path.join(path, 'deep'))
    sb.spawn(['sleep', '60'], cwd=os.path.join(path, 'deep'))
    items = [T(path, sha), other_item(sb)]
    assert_skip_and_continue(sb, items, f'tree {path}', 'procs', sb.run(sb.manifest(items), go=True))
    assert os.path.isdir(path)


def test_trip_listening_server_cwd_in_tree(sb):
    sha = sb.merged_branch('a')
    path = sb.tree('a')
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]
    p = sb.spawn([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'], cwd=path)
    for _ in range(100):
        if f'pid={p.pid},' in subprocess.run(['ss', '-ltnpH'], capture_output=True, text=True).stdout:
            break
        time.sleep(0.05)
    items = [T(path, sha), other_item(sb)]
    assert_skip_and_continue(sb, items, f'tree {path}', f'servers [\'{p.pid}\']',
                             sb.run(sb.manifest(items), go=True))


def test_trip_unmerged_tip(sb):
    sb.git('checkout', '-q', '-b', 'u')
    sha = sb.commit('never merged')
    sb.git('checkout', '-q', 'main')
    path = sb.tree('u')
    items = [T(path, sha), other_item(sb)]   # the manifest claims ancestor
    assert_skip_and_continue(sb, items, f'tree {path}', 'merge UNMERGED:1',
                             sb.run(sb.manifest(items), go=True))


def test_trip_dirty_submodule(sb):
    sub = os.path.join(sb.tmp, 'sub.git')
    sb.git('init', '-q', '--bare', sub, cwd=sb.tmp)
    seed = os.path.join(sb.tmp, 'subseed')
    sb.git('clone', '-q', sub, seed, cwd=sb.tmp)
    sb.commit('sub base', cwd=seed)
    sb.git('push', '-q', 'origin', 'HEAD:main', cwd=seed)
    sb.git('submodule', 'add', '-q', sub, 'sub')
    sb.git('commit', '-q', '-m', 'add sub')
    sb.git('push', '-q', 'origin', 'main')
    sb.git('branch', 's')
    sha = sb.git('rev-parse', 's')
    clean = sb.tree('s')
    sb.git('submodule', 'update', '-q', '--init', cwd=clean)
    sb.git('branch', 's2')
    dirty = sb.tree('s2')
    sb.git('submodule', 'update', '-q', '--init', cwd=dirty)
    open(os.path.join(dirty, 'sub', 'junk.txt'), 'w').write('x')
    items = [T(clean, sha), T(dirty, sha), other_item(sb)]
    rc_out = sb.run(sb.manifest(items), go=True)
    # the dirty one is a SKIP; the clean one (submodules need --force) is removed
    assert_skip_and_continue(sb, items, f'tree {dirty}', 'sub sub dirty', rc_out)
    assert not os.path.exists(clean), rc_out[1]
    assert os.path.isdir(dirty)


def test_trip_moved_local_tip(sb):
    sha = sb.merged_branch('a', push=False)
    sb.git('branch', '-f', 'a', 'HEAD~1')
    items = [B('local', 'a', sha), other_item(sb)]
    assert_skip_and_continue(sb, items, 'local a', 'tip ', sb.run(sb.manifest(items), go=True))
    assert sb.local('a')


def test_trip_local_checked_out_in_a_staying_tree(sb):
    sha = sb.merged_branch('a', push=False)
    path = sb.tree('a')                     # the tree is NOT in the manifest
    items = [B('local', 'a', sha), other_item(sb)]
    rc_out = sb.run(sb.manifest(items))
    assert 'SKIP local a: ' in rc_out[1] and 'checked out in' in rc_out[1]   # the dry run says so too
    assert_skip_and_continue(sb, items, 'local a', f'checked out in [\'{path}\']',
                             sb.run(sb.manifest(items), go=True))


def test_dry_run_counts_a_branch_held_by_an_ok_tree_as_freed(sb):
    sha, path, items = full_set(sb, 'a')
    rc, out = sb.run(sb.manifest(items))
    assert rc == 0 and 'OK local a ' in out, out


def test_trip_moved_fork_tip(sb):
    sha = sb.merged_branch('a')
    sb.git('push', '-q', '-f', 'origin', 'HEAD~1:refs/heads/a')
    items = [B('fork', 'a', sha), other_item(sb)]
    assert_skip_and_continue(sb, items, 'fork a', 'fork tip ', sb.run(sb.manifest(items), go=True))
    assert sb.fork('a')


def test_trip_fork_lease_fails_when_the_tip_moves_after_the_check(sb):
    sha = sb.merged_branch('a')
    moved = sb.git('rev-parse', 'HEAD~1')
    items = [B('fork', 'a', sha), other_item(sb)]
    rc, out = sb.run(sb.manifest(items), go=True, env={'WRAP_MOVE_FORK_TO': moved})
    assert rc == 1, out
    assert "FAILED ['fork a']" in out
    assert sb.fork('a').split()[0] == moved     # the moved ref survives: the lease held
    assert not sb.local('other')


def test_unmerged_needs_allow_unmerged_and_then_deletes_with_D(sb):
    sb.git('checkout', '-q', '-b', 'bh')
    sha = sb.commit('report only')
    sb.git('checkout', '-q', 'main')
    sb.git('push', '-q', 'origin', 'bh')
    items = [B('local', 'bh', sha, merge='UNMERGED:1', group='BH'), other_item(sb)]
    assert_skip_and_continue(sb, items, 'local bh', 'allow_unmerged',
                             sb.run(sb.manifest(items), go=True))
    items = [B('local', 'bh', sha, merge='UNMERGED:1', group='BH', allow_unmerged=True),
             B('fork', 'bh', sha, merge='UNMERGED:1', group='BH', allow_unmerged=True)]
    rc, out = sb.run(sb.manifest(items), go=True)
    assert rc == 0, out
    assert not sb.local('bh') and not sb.fork('bh')
    assert 'branch -D (unmerged, allow_unmerged)' in out


# ── -d fails → full re-measure → -D ─────────────────────────────────────

def cherry_equal_branch(sb, name):
    sb.git('checkout', '-q', '-b', name)
    sha = sb.commit(f'{name} change', file=f'{name}.txt')
    sb.git('checkout', '-q', 'main')
    sb.commit(f'main moves on before {name} is picked')   # else the pick IS the same commit
    sb.git('cherry-pick', sha)
    sb.git('push', '-q', 'origin', 'main')
    return sha


def test_d_failure_remeasures_then_D(sb):
    sha = cherry_equal_branch(sb, 'c')
    rc, out = sb.run(sb.manifest([B('local', 'c', sha, merge='cherry-equal')]), go=True)
    assert rc == 0, out
    assert 'DONE branch -d: rc=1' in out
    assert 're-measure after -d failed: unchanged (cherry-equal), so -D' in out
    assert not sb.local('c')


def test_d_failure_with_a_moved_tip_skips_instead_of_D(sb):
    sha = cherry_equal_branch(sb, 'c')
    sb.git('checkout', '-q', '-b', 'elsewhere')
    moved = sb.commit('unrelated unmerged')
    sb.git('checkout', '-q', 'main')
    items = [B('local', 'c', sha, merge='cherry-equal'), other_item(sb)]
    rc_out = sb.run(sb.manifest(items), go=True, env={'WRAP_MOVE_REF': 'c', 'WRAP_MOVE_REF_TO': moved})
    assert_skip_and_continue(sb, items, 'local c', 're-measure after -d failed', rc_out)
    assert sb.local('c') == moved


# ── refusals ────────────────────────────────────────────────────────────

def test_self_integrity_refuses_an_edited_script(sb):
    sha, path, items = full_set(sb, 'a')
    with open(os.path.join(sb.primary, REL), 'a') as f:
        f.write('# edited\n')
    m = sb.manifest(items)
    rc, out = sb.run(m)
    assert 'GO would refuse' in out and 'differs from origin/main' in out
    before = sb.state()
    rc, out = sb.run(m, go=True)
    assert rc == 2 and 'REFUSED: this file differs from origin/main' in out, out
    assert sb.state() == before


def test_wrong_or_missing_manifest_sha256_refuses(sb):
    sha, path, items = full_set(sb, 'a')
    m = sb.manifest(items)
    before = sb.state()
    for sha_arg in ['0' * 64, None]:
        rc, out = sb.run(m, go=True, sha=sha_arg)
        assert rc == 2 and 'REFUSED: --manifest-sha256' in out, out
    # the right value, but the manifest edited after the dry run
    digest = hashlib.sha256(open(m, 'rb').read()).hexdigest()
    with open(m, 'a') as f:
        f.write('\n')
    rc, out = sb.run(m, go=True, sha=digest)
    assert rc == 2 and 'REFUSED: --manifest-sha256' in out, out
    assert sb.state() == before


def test_open_pr_head_in_the_manifest_refuses(sb):
    sha, path, items = full_set(sb, 'a')
    m = sb.manifest(items)
    before = sb.state()
    rc, out = sb.run(m, go=True, env={'GH_STUB_JSON': json.dumps([{'headRefName': 'a'}])})
    assert rc == 2 and "open PR head(s) in the manifest: ['a']" in out, out
    calls = open(os.path.join(sb.env['XDG_CACHE_HOME'], 'gh-calls')).read()
    assert '-R PeerInfinity/Archipelago-CC --state open --json headRefName' in calls
    # a tree's branch counts too, though the manifest names only the tree
    rc, out = sb.run(sb.manifest([items[0]]), go=True,
                     env={'GH_STUB_JSON': json.dumps([{'headRefName': 'a'}])})
    assert rc == 2 and 'open PR head' in out, out
    # gh failing is a refusal, not a pass
    rc, out = sb.run(m, go=True, env={'GH_STUB_RC': '1'})
    assert rc == 2 and 'gh pr list failed' in out, out
    assert sb.state() == before
    # an unrelated open PR does not refuse
    rc, out = sb.run(m, go=True, env={'GH_STUB_JSON': json.dumps([{'headRefName': 'other'}])})
    assert rc == 0, out


def test_box_lock_held_by_someone_else_refuses(sb):
    sha, path, items = full_set(sb, 'a')
    m = sb.manifest(items)
    holder = sb.spawn(['sleep', '60'], cwd=sb.tmp)
    lockdir = os.path.join(sb.env['XDG_CACHE_HOME'], 'seedling-box')
    os.makedirs(lockdir)
    with open(os.path.join(lockdir, 'lock.json'), 'w') as f:
        json.dump({'token': 'tok', 'pid': holder.pid, 'name': 'npm test x', 'kind': 'browser',
                   'since': 'now'}, f)
    before = sb.state()
    rc, out = sb.run(m, go=True)
    assert rc == 2 and "REFUSED: box lock held by 'npm test x'" in out, out
    assert sb.state() == before
    # under the holder's own token it passes
    rc, out = sb.run(m, go=True, env={'SEEDLING_BOX_LOCK_TOKEN': 'tok'})
    assert rc == 0, out


def test_fetch_failure_refuses(sb):
    sha, path, items = full_set(sb, 'a')
    m = sb.manifest(items)
    sb.git('remote', 'set-url', 'origin', os.path.join(sb.tmp, 'nowhere.git'))
    rc, out = sb.run(m)
    assert rc == 2 and 'REFUSED: git fetch origin failed' in out, out


@pytest.mark.parametrize('mutate, msg', [
    (lambda it: it.update(sha=it['sha'][:10]), 'full 40-hex'),
    (lambda it: it.update(extra=1), 'unknown keys'),
    (lambda it: it.update(merge='merged'), 'merge must be'),
    (lambda it: it.update(ruling=''), 'ruling must be'),
    (lambda it: it.update(allow_unmerged=True), 'not UNMERGED'),
    (lambda it: it.update(path='relative/wt'), 'path must be absolute'),
])
def test_bad_manifest_refuses(sb, mutate, msg):
    sha, path, items = full_set(sb, 'a')
    mutate(items[0])
    rc, out = sb.run(sb.manifest(items))
    assert rc == 2 and 'REFUSED: manifest: ' in out and msg in out, out


def test_example_manifest_fixture_is_valid():
    """The documented example validates (dry-run against a sandbox is not needed for that)."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('remove_worktree', SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    ex = os.path.join(ROOT, 'test', 'data', 'remove-worktree', 'example.approved.json')
    assert mod.validate(json.load(open(ex))) == []


def test_only_registered_linked_worktrees_are_removed(sb):
    sha = sb.git('rev-parse', 'HEAD')
    plain = os.path.join(sb.tmp, 'plain-dir')
    os.makedirs(plain)
    items = [T(plain, sha), T(os.path.realpath(sb.primary), sha), other_item(sb)]
    rc, out = sb.run(sb.manifest(items), go=True)
    assert rc == 1, out
    assert f'SKIP tree {plain}: ' in out and 'not a registered worktree' in out
    assert 'refusing the main worktree' in out
    assert os.path.isdir(plain) and os.path.isdir(sb.primary)
    assert not sb.local('other')
