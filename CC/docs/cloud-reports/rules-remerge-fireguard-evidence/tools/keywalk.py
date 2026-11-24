#!/usr/bin/env python3
"""Key walk: ADD / DEL / CHG per JSON path between a file at a git rev and the working tree.
Usage: keywalk.py <rev> <path> [<path> ...]   (lists are walked by index, except lists of
single-key dicts, e.g. exits [{"name": rule}], which are walked by that key)."""
import json, subprocess, sys

def load_rev(rev, p):
    return json.loads(subprocess.run(['git', 'show', f'{rev}:{p}'], capture_output=True, check=True).stdout)

def keyed(lst):
    if lst and all(isinstance(x, dict) for x in lst):
        for k in ('name', 'id', 'region', 'exit_id', 'key'):
            if all(k in x for x in lst):
                ks = [str(x[k]) for x in lst]
                if len(set(ks)) == len(ks):
                    return {f'{k}={v}': x for v, x in zip(ks, lst)}
    return {f'[{i}]': x for i, x in enumerate(lst)}

def walk(a, b, path, out):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b), key=str):
            if k not in a: out.append(('ADD', f'{path}/{k}', None, b[k]))
            elif k not in b: out.append(('DEL', f'{path}/{k}', a[k], None))
            else: walk(a[k], b[k], f'{path}/{k}', out)
    elif isinstance(a, list) and isinstance(b, list):
        walk(keyed(a), keyed(b), path, out)
    elif a != b:
        out.append(('CHG', path, a, b))

def short(v):
    s = json.dumps(v, sort_keys=True)
    return s if len(s) <= 300 else s[:300] + '…'

rev = sys.argv[1]
for p in sys.argv[2:]:
    out = []
    walk(load_rev(rev, p), json.load(open(p)), '', out)
    print(f'## {p} vs {rev}: {len(out)} change(s)')
    for op, path, a, b in out:
        print(f'{op} {path}\n    - {short(a)}\n    + {short(b)}')
