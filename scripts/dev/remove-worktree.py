#!/usr/bin/env python3
"""remove-worktree.py: carry out an APPROVED cleanup manifest, item by item.

This is the removal half that `new-worktree.sh` deliberately does not have.
It NEVER surveys. It removes exactly the worktrees, local branches and fork
branches that a manifest names, and only if each one still measures exactly
as the manifest says at the moment it is acted on. The survey session writes
the manifest. Robert rules on it (branch retention is his manual review,
2026-09-27). Robert types the `--go` line himself with `!` (ruling
2026-11-10). Sessions run the dry run and never run `--go`.

Usage
-----
    python3 scripts/dev/remove-worktree.py <manifest.json>
        dry run (the default): changes nothing. Prints the manifest's sha256,
        the pre-flight results and one OK/SKIP verdict per item, the same
        verdicts a GO run would act on.
    python3 scripts/dev/remove-worktree.py --go --manifest-sha256=<hex> <manifest.json>
        acts. <hex> must be the sha256 the dry run printed, so the line Robert
        types is bound to the exact list he saw. An edited manifest refuses.

Exit status: 0 only when nothing was refused, skipped or failed. 1 when any
item was SKIPped or an action failed (the summary names each one). 2 on a
pre-flight refusal or a bad manifest.

Log: every run (dry or GO) is appended to
`$XDG_CACHE_HOME/worktree-cleanup/<manifest-stem>-<UTC>.log`
(`~/.cache/...` when XDG_CACHE_HOME is unset). That is a fixed place, never
relative to the cwd.

Repository: the repository that holds THIS file. Git commands run in this
file's own worktree. `origin` is the fork, and `origin/main` is the merge
reference, freshly fetched.

Linux only: the process checks read `/proc/<pid>/cwd` and `ss -ltnp`.

Manifest schema (JSON, version 1)
---------------------------------
    {
      "schema": 1,
      "survey": "branch-worktree-cleanup-2026-11-10.md",   (optional, informational: the survey record)
      "items": [ <item>, ... ]
    }
An item is an object with exactly these keys (an unknown key refuses the manifest):
    kind            "tree" | "local" | "fork"
    path            (tree only) the absolute worktree path
    ref             (local/fork only) the branch name, without "refs/heads/"
    sha             the FULL 40-hex expected SHA: the tree's HEAD, the local
                    tip, or the fork tip
    merge           the expected merge state against origin/main:
                    "ancestor" | "cherry-equal" | "UNMERGED:<n>"
                    (n = the number of `git cherry` "+" commits)
    dirt            (tree only) a list of the exact
                    `git status --porcelain --ignore-submodules=none` lines
                    allowed. [] means clean. They are discarded with the tree,
                    and logged first.
    group           the survey group, e.g. "WA"
    ruling          Robert's ruling for that group, quoted verbatim
    allow_unmerged  (optional, default false) true only when the ruling covers
                    deleting this item UNMERGED (e.g. round 6's BH group). It
                    must be true for an UNMERGED item to be acted on, and it
                    may not be set on a merged item.
Order: trees are handled first (removing a tree frees its branch), then local
branches, then fork branches, each kind in manifest order.

Per-item checks (re-measured immediately before acting; any change -> SKIP,
and the rest of the run continues)
    tree:  a registered worktree of this repository, but neither its main
           worktree nor the one running this script · HEAD == sha · merge
           state == merge · porcelain dirt == dirt · every initialised
           submodule is unmoved, clean, and its HEAD is on a remote branch ·
           no process has its cwd in the tree · no listening server
           (`ss -ltnp`) has its cwd in the tree.
           Removal: `git worktree remove [--force] <path>`. `--force` is used
           only when the tree has allowed dirt or initialised submodules (git
           refuses to remove a tree that has submodules without it), and only
           after the checks above passed.
    local: refs/heads/<ref> == sha · merge state == merge · not checked out in
           any worktree (in a dry run, a tree that is itself OK in this run
           counts as freed).
           Deletion: `git branch -d`. If -d fails, the FULL check is re-run, and
           only an unchanged ancestor/cherry-equal result allows `-D`;
           anything else is a SKIP. `-D` is used directly only for an UNMERGED
           item with allow_unmerged.
    fork:  `git ls-remote origin refs/heads/<ref>` == sha · merge state == merge.
           Deletion: `git push origin --force-with-lease=refs/heads/<ref>:<sha> --delete <ref>`.

Pre-flight (a GO run refuses outright; a dry run reports "GO WOULD REFUSE")
    · `git fetch --prune origin` fails (a dry run stops too: there is nothing to measure against)
    · the box lock (`$XDG_CACHE_HOME/seedling-box/lock.json`) is held by a live
      process other than this one's holder (SEEDLING_BOX_LOCK_TOKEN)
    · `gh pr list -R PeerInfinity/Archipelago-CC --state open --json headRefName`
      fails, or an open PR's head is a manifest ref or a manifest tree's branch
    · GO only: --manifest-sha256 is missing or differs from the manifest's sha256
    · GO only (a dry run reports it): this file differs from
      `origin/main:scripts/dev/remove-worktree.py`, so an edited copy cannot act
"""
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys

REMOTE = 'origin'
MAIN = 'main'
PR_REPO = 'PeerInfinity/Archipelago-CC'
SCRIPT_REL = 'scripts/dev/remove-worktree.py'
BOX_TOKEN_ENV = 'SEEDLING_BOX_LOCK_TOKEN'
SHA_RE = re.compile(r'^[0-9a-f]{40}$')
MERGE_RE = re.compile(r'^(ancestor|cherry-equal|UNMERGED:[1-9][0-9]*)$')
REF_RE = re.compile(r'^(?!-)(?!refs/)(?!.*\.\.)[A-Za-z0-9._/@+-]+$')
KEYS = {
    'tree': ({'kind', 'path', 'sha', 'merge', 'dirt', 'group', 'ruling'}, {'allow_unmerged'}),
    'local': ({'kind', 'ref', 'sha', 'merge', 'group', 'ruling'}, {'allow_unmerged'}),
    'fork': ({'kind', 'ref', 'sha', 'merge', 'group', 'ruling'}, {'allow_unmerged'}),
}

HERE = os.path.dirname(os.path.realpath(__file__))


def run(args, cwd):
    p = subprocess.run(args, cwd=cwd, capture_output=True, text=True)
    return p.returncode, p.stdout, p.stderr


def cache_dir():
    return os.environ.get('XDG_CACHE_HOME') or os.path.join(os.path.expanduser('~'), '.cache')


class Log:
    def __init__(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.path = path
        self.f = open(path, 'a', encoding='utf-8')

    def __call__(self, msg):
        print(msg, flush=True)
        self.f.write(msg + '\n')
        self.f.flush()


def validate(doc):
    """Return a list of problems; [] means the manifest is well-formed."""
    errs = []
    if not isinstance(doc, dict):
        return ['top level is not an object']
    extra = set(doc) - {'schema', 'survey', 'items'}
    if extra:
        errs.append(f'unknown top-level keys {sorted(extra)}')
    if doc.get('schema') != 1:
        errs.append('schema must be 1')
    items = doc.get('items')
    if not isinstance(items, list) or not items:
        return errs + ['items must be a non-empty list']
    seen = set()
    for i, it in enumerate(items):
        where = f'item {i}'
        if not isinstance(it, dict) or it.get('kind') not in KEYS:
            errs.append(f'{where}: kind must be one of {sorted(KEYS)}')
            continue
        need, opt = KEYS[it['kind']]
        if need - set(it):
            errs.append(f'{where}: missing {sorted(need - set(it))}')
        if set(it) - need - opt:
            errs.append(f'{where}: unknown keys {sorted(set(it) - need - opt)}')
        if not SHA_RE.match(str(it.get('sha', ''))):
            errs.append(f'{where}: sha must be a full 40-hex SHA')
        if not MERGE_RE.match(str(it.get('merge', ''))):
            errs.append(f'{where}: merge must be ancestor | cherry-equal | UNMERGED:<n>')
        for k in ('group', 'ruling'):
            if not isinstance(it.get(k), str) or not it.get(k).strip():
                errs.append(f'{where}: {k} must be a non-empty string')
        au = it.get('allow_unmerged', False)
        if not isinstance(au, bool):
            errs.append(f'{where}: allow_unmerged must be a boolean')
        elif au and not str(it.get('merge', '')).startswith('UNMERGED:'):
            errs.append(f'{where}: allow_unmerged is set on an item that is not UNMERGED')
        if it['kind'] == 'tree':
            p = it.get('path')
            if not isinstance(p, str) or not os.path.isabs(p):
                errs.append(f'{where}: path must be absolute')
            d = it.get('dirt')
            if not isinstance(d, list) or not all(isinstance(x, str) and x for x in d):
                errs.append(f'{where}: dirt must be a list of porcelain lines')
            key = ('tree', os.path.normpath(p) if isinstance(p, str) else p)
        else:
            r = it.get('ref')
            if not isinstance(r, str) or not REF_RE.match(r):
                errs.append(f'{where}: ref must be a plain branch name (no refs/, no ..)')
            key = (it['kind'], r)
        if key in seen:
            errs.append(f'{where}: duplicate {key}')
        seen.add(key)
    return errs


class Cleaner:
    def __init__(self, log, go):
        self.log = log
        self.go = go
        rc, out, _ = run(['git', 'rev-parse', '--show-toplevel'], HERE)
        if rc:
            raise SystemExit('this script is not inside a git worktree')
        self.top = os.path.realpath(out.strip())
        self.om: str = ''

    def git(self, *a, cwd=None):
        return run(['git', *a], cwd or self.top)

    # ── measurements ─────────────────────────────────────────────────
    def merge_state(self, sha):
        rc, _, err = self.git('merge-base', '--is-ancestor', sha, self.om)
        if rc == 0:
            return 'ancestor'
        if rc != 1:
            return f'ERROR(merge-base: {err.strip()})'
        rc, out, err = self.git('cherry', self.om, sha)
        if rc:
            return f'ERROR(cherry: {err.strip()})'
        plus = [l for l in out.splitlines() if l.startswith('+')]
        return 'cherry-equal' if not plus else f'UNMERGED:{len(plus)}'

    def worktrees(self):
        """[(realpath, branch-name-or-None)] in `git worktree list` order (main first)."""
        rc, out, _ = self.git('worktree', 'list', '--porcelain')
        res, path, br = [], None, None
        for l in out.splitlines() + ['']:
            if l.startswith('worktree '):
                path, br = os.path.realpath(l[9:]), None
            elif l.startswith('branch refs/heads/'):
                br = l[len('branch refs/heads/'):]
            elif not l and path:
                res.append((path, br))
                path = None
        return res

    @staticmethod
    def inside(c, p):
        return c == p or c.startswith(p + '/')

    def procs_in(self, p):
        me, out = str(os.getpid()), []
        for pid in os.listdir('/proc'):
            if not pid.isdigit() or pid == me:
                continue
            try:
                c = os.readlink(f'/proc/{pid}/cwd')
            except OSError:
                continue
            if self.inside(c, p):
                out.append(pid)
        return out

    def servers_in(self, p):
        rc, out, err = run(['ss', '-ltnpH'], '/')
        if rc:
            return None
        o = []
        for pid in sorted(set(re.findall(r'pid=(\d+)', out))):
            try:
                c = os.readlink(f'/proc/{pid}/cwd')
            except OSError:
                continue
            if self.inside(c, p):
                o.append(pid)
        return o

    def submodule_problems(self, p):
        rc, out, err = run(['git', 'submodule', 'status', '--recursive'], p)
        if rc:
            return [f'submodule status failed: {err.strip()}'], False
        why, any_init = [], False
        for l in out.splitlines():
            if not l or l[0] == '-':
                continue
            any_init = True
            parts = l[1:].split()
            path = parts[1]
            sp = os.path.join(p, path)
            if l[0] != ' ':
                why.append(f'sub {path} state {l[0]!r}')
            rc, sh, _ = run(['git', 'rev-parse', 'HEAD'], sp)
            rc2, on, _ = run(['git', 'branch', '-r', '--contains', sh.strip()], sp)
            if rc or rc2 or not on.strip():
                why.append(f'sub {path} HEAD not on a remote')
            rc, st, _ = run(['git', 'status', '--porcelain'], sp)
            if rc or st.strip():
                why.append(f'sub {path} dirty')
        return why, any_init

    def common_checks(self, item, sha):
        why = []
        m = self.merge_state(sha)
        if m != item['merge']:
            why.append(f'merge {m} (expected {item["merge"]})')
        if item['merge'].startswith('UNMERGED:') and not item.get('allow_unmerged'):
            why.append('UNMERGED but allow_unmerged is not set (the ruling must cover an unmerged delete)')
        return why

    def check_tree(self, item):
        p = os.path.realpath(item['path'])
        info = {'path': p, 'force': bool(item['dirt']), 'dirt': []}
        if not os.path.isdir(p):
            return ['missing'], info
        wts = self.worktrees()
        if p not in [w for w, _ in wts]:
            return ['not a registered worktree of this repository'], info
        if p == wts[0][0] or p == self.top:
            return ['refusing the main worktree / the tree running this script'], info
        why = []
        rc, head, _ = self.git('rev-parse', 'HEAD', cwd=p)
        head = head.strip()
        if rc or head != item['sha']:
            why.append(f'HEAD {head[:10] or "?"} (expected {item["sha"][:10]})')
        else:
            why += self.common_checks(item, head)
        rc, st, err = run(['git', 'status', '--porcelain', '--ignore-submodules=none'], p)
        lines = [l for l in st.splitlines() if l]
        info['dirt'] = lines
        if rc:
            why.append(f'status failed: {err.strip()}')
        elif sorted(lines) != sorted(item['dirt']):
            why.append(f'status {lines} (allowed {item["dirt"]})')
        sub, any_init = self.submodule_problems(p)
        why += sub
        info['force'] = info['force'] or any_init
        pr = self.procs_in(p)
        if pr:
            why.append(f'procs {pr}')
        sv = self.servers_in(p)
        if sv is None:
            why.append('ss -ltnp failed')
        elif sv:
            why.append(f'servers {sv}')
        return why, info

    def check_local(self, item, freed=()):
        n = item['ref']
        rc, t, _ = self.git('rev-parse', '--verify', '-q', 'refs/heads/' + n)
        t = t.strip()
        if rc or not t:
            return ['missing']
        why = []
        if t != item['sha']:
            why.append(f'tip {t[:10]} (expected {item["sha"][:10]})')
        else:
            why += self.common_checks(item, t)
        holders = [w for w, b in self.worktrees() if b == n and w not in freed]
        if holders:
            why.append(f'checked out in {holders}')
        return why

    def check_fork(self, item):
        n = item['ref']
        rc, out, err = self.git('ls-remote', REMOTE, 'refs/heads/' + n)
        if rc:
            return [f'ls-remote failed: {err.strip()}']
        rt = out.split()
        if not rt:
            return ['missing on fork']
        if rt[0] != item['sha']:
            return [f'fork tip {rt[0][:10]} (expected {item["sha"][:10]})']
        rc, _, _ = self.git('cat-file', '-e', rt[0] + '^{commit}')
        if rc:
            return ['fork tip not present locally (cannot measure its merge state)']
        return self.common_checks(item, rt[0])

    # ── pre-flight ───────────────────────────────────────────────────
    def box_lock_problem(self):
        f = os.path.join(cache_dir(), 'seedling-box', 'lock.json')
        if not os.path.exists(f):
            return None
        try:
            cur = json.load(open(f, encoding='utf-8'))
            pid = int(cur.get('pid'))
        except Exception as e:  # noqa: BLE001 — an unreadable lock is not a free box
            return f'box lock {f} is unreadable ({e})'
        try:
            os.kill(pid, 0)
        except ProcessLookupError:
            return None  # stale: its holder is gone
        except PermissionError:
            pass
        if cur.get('token') and cur.get('token') == os.environ.get(BOX_TOKEN_ENV):
            return None  # we run under the holder
        return (f'box lock held by {cur.get("name")!r} (pid {pid}, {cur.get("kind")}, '
                f'since {cur.get("since")})')

    def open_pr_problem(self, names):
        rc, out, err = run(['gh', 'pr', 'list', '-R', PR_REPO, '--state', 'open',
                            '--json', 'headRefName', '-L', '1000'], self.top)
        if rc:
            return f'gh pr list failed (rc={rc}): {err.strip() or out.strip()}', None
        try:
            heads = sorted({p['headRefName'] for p in json.loads(out)})
        except Exception as e:  # noqa: BLE001
            return f'gh pr list output unparsable ({e})', None
        hit = sorted(set(heads) & set(names))
        if hit:
            return f'open PR head(s) in the manifest: {hit}', heads
        return None, heads

    def self_integrity_problem(self):
        p = subprocess.run(['git', 'show', f'{REMOTE}/{MAIN}:{SCRIPT_REL}'], cwd=self.top,
                           capture_output=True)
        if p.returncode:
            return f'{REMOTE}/{MAIN}:{SCRIPT_REL} unreadable ({p.stderr.decode(errors="replace").strip()})'
        if os.path.realpath(__file__) != os.path.join(self.top, SCRIPT_REL):
            return f'this file is not {SCRIPT_REL} of the tree it runs in'
        if open(os.path.realpath(__file__), 'rb').read() != p.stdout:
            return f'this file differs from {REMOTE}/{MAIN}:{SCRIPT_REL}'
        return None


def main(argv=None):
    ap = argparse.ArgumentParser(description='Carry out an approved worktree/branch cleanup manifest '
                                             '(dry run unless --go).')
    ap.add_argument('manifest')
    ap.add_argument('--go', action='store_true', help='act (Robert types this himself)')
    ap.add_argument('--manifest-sha256', help='required with --go: the sha256 the dry run printed')
    a = ap.parse_args(argv)

    if not sys.platform.startswith('linux'):
        print('refused: Linux only (/proc/<pid>/cwd, ss -ltnp)', file=sys.stderr)
        return 2
    raw = open(a.manifest, 'rb').read()
    digest = hashlib.sha256(raw).hexdigest()
    stem = os.path.splitext(os.path.basename(a.manifest))[0]
    utc = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    log = Log(os.path.join(cache_dir(), 'worktree-cleanup', f'{stem}-{utc}.log'))
    mode = 'GO' if a.go else 'DRY'
    log(f'mode {mode}; manifest {os.path.abspath(a.manifest)}; sha256 {digest}; log {log.path}')

    try:
        doc = json.loads(raw.decode('utf-8'))
    except Exception as e:  # noqa: BLE001
        log(f'REFUSED: manifest is not valid JSON ({e})')
        return 2
    errs = validate(doc)
    if errs:
        for e in errs:
            log(f'REFUSED: manifest: {e}')
        return 2
    if a.go and a.manifest_sha256 != digest:
        log(f'REFUSED: --manifest-sha256 {a.manifest_sha256!r} does not match the manifest ({digest}); '
            're-run the dry run and read the list again')
        return 2

    c = Cleaner(log, a.go)
    refusals = []
    rc, _, err = c.git('fetch', '--prune', '-q', REMOTE)
    if rc:
        log(f'REFUSED: git fetch {REMOTE} failed: {err.strip()}')
        return 2
    rc, om, _ = c.git('rev-parse', '--verify', f'refs/remotes/{REMOTE}/{MAIN}')
    if rc:
        log(f'REFUSED: no {REMOTE}/{MAIN}')
        return 2
    c.om = om.strip()
    log(f'repo {c.top}; {REMOTE}/{MAIN} {c.om}')

    items = doc['items']
    trees = [i for i in items if i['kind'] == 'tree']
    locs = [i for i in items if i['kind'] == 'local']
    forks = [i for i in items if i['kind'] == 'fork']

    p = c.box_lock_problem()
    if p:
        refusals.append(p)
    tree_branches = {w: b for w, b in c.worktrees()}
    names = [i['ref'] for i in locs + forks]
    names += [tree_branches.get(os.path.realpath(t['path'])) for t in trees]
    p, heads = c.open_pr_problem([n for n in names if n])
    if p:
        refusals.append(p)
    else:
        log(f'open PR heads: {heads}')
    p = c.self_integrity_problem()
    if p:
        refusals.append(p if a.go else f'{p} (GO would refuse)')
    for r in refusals:
        log(f'{"REFUSED" if a.go else "PRE-FLIGHT"}: {r}')
    if refusals and a.go:
        return 2

    skips, failed = [], []

    def skip(label, why):
        log(f'SKIP {label}: {why}')
        skips.append(label)

    # ── trees ──
    freed = set()
    for t in trees:
        label = f'tree {t["path"]}'
        why, info = c.check_tree(t)
        if why:
            skip(label, why)
            continue
        log(f'OK {label} @ {t["sha"][:10]} merge={t["merge"]} dirt={info["dirt"]} [{t["group"]}]')
        br = tree_branches.get(info['path'])
        if not a.go:
            if br:
                freed.add(info['path'])
            continue
        args = ['git', 'worktree', 'remove'] + (['--force'] if info['force'] else []) + [info['path']]
        if info['dirt']:
            log(f'  discarding with {t["path"]}: {info["dirt"]}')
        if info['force']:
            log('  --force: allowed dirt and/or initialised submodules (git refuses a tree with '
                'submodules without it); the checks above passed')
        rc, out, err = run(args, c.top)
        log(f'  DONE worktree remove: rc={rc} {(out + err).strip()}')
        if rc or os.path.exists(info['path']):
            failed.append(label)

    # ── local branches ──
    for b in locs:
        label = f'local {b["ref"]}'
        why = c.check_local(b, freed)
        if why:
            skip(label, why)
            continue
        log(f'OK {label} @ {b["sha"][:10]} {b["merge"]} [{b["group"]}]')
        if not a.go:
            continue
        unmerged = b['merge'].startswith('UNMERGED:')
        rc, out, err = c.git('branch', '-D' if unmerged else '-d', b['ref'])
        log(f'  DONE branch {"-D (unmerged, allow_unmerged)" if unmerged else "-d"}: rc={rc} '
            f'{(out + err).strip()}')
        if rc == 0:
            continue
        if unmerged:
            failed.append(label)
            continue
        why = c.check_local(b)
        if why:
            skip(label, f're-measure after -d failed: {why}')
            continue
        log(f'  re-measure after -d failed: unchanged ({b["merge"]}), so -D')
        rc, out, err = c.git('branch', '-D', b['ref'])
        log(f'  DONE branch -D: rc={rc} {(out + err).strip()}')
        if rc:
            failed.append(label)

    # ── fork branches ──
    for f in forks:
        label = f'fork {f["ref"]}'
        why = c.check_fork(f)
        if why:
            skip(label, why)
            continue
        log(f'OK {label} @ {f["sha"][:10]} {f["merge"]} [{f["group"]}]')
        if not a.go:
            continue
        rc, out, err = c.git('push', REMOTE, f'--force-with-lease=refs/heads/{f["ref"]}:{f["sha"]}',
                             '--delete', f['ref'])
        log(f'  DONE push --delete (lease {f["sha"][:10]}): rc={rc} {(out + err).strip()}')
        if rc:
            failed.append(label)

    log(f'summary {mode}: {len(items)} items; {len(skips)} SKIP {skips}; {len(failed)} FAILED {failed}'
        + (f'; {len(refusals)} PRE-FLIGHT {refusals}' if refusals else ''))
    if not a.go:
        log(f'GO line (Robert types it with !): python3 {SCRIPT_REL} --go '
            f'--manifest-sha256={digest} {a.manifest}')
    if refusals:
        return 2
    return 1 if skips or failed else 0


if __name__ == '__main__':
    sys.exit(main())
