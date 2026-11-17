#!/usr/bin/env python3
"""json-key-diff — walk two JSON documents key by key and print every leaf path that is ADDed, DELeted or CHanGed.

Usage: json-key-diff.py <git-ref-a> <git-ref-b> <path> [<path> ...]
       (ref `WT` = the working tree). Lists are walked by index; a dict key is quoted in the path.
"""
import json, subprocess, sys

def load(ref, path):
    if ref == 'WT':
        return json.load(open(path, encoding='utf-8'))
    return json.loads(subprocess.check_output(['git', 'show', f'{ref}:{path}']))

def walk(a, b, p, out):
    if isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b), key=str):
            q = f'{p}[{json.dumps(k, ensure_ascii=False)}]'
            if k not in a: out.append(('ADD', q, None, b[k]))
            elif k not in b: out.append(('DEL', q, a[k], None))
            else: walk(a[k], b[k], q, out)
    elif isinstance(a, list) and isinstance(b, list):
        for i in range(max(len(a), len(b))):
            q = f'{p}[{i}]'
            if i >= len(a): out.append(('ADD', q, None, b[i]))
            elif i >= len(b): out.append(('DEL', q, a[i], None))
            else: walk(a[i], b[i], q, out)
    elif a != b:
        out.append(('CHG', p, a, b))

def short(v):
    s = json.dumps(v, ensure_ascii=False)
    return s if len(s) <= 300 else s[:300] + f'…(+{len(s) - 300})'

ra, rb = sys.argv[1], sys.argv[2]
for path in sys.argv[3:]:
    out = []
    walk(load(ra, path), load(rb, path), '', out)
    print(f'## {path}: {len(out)} leaf change(s) {ra} -> {rb}')
    for kind, q, x, y in out:
        print(f'{kind} {q}')
        if x is not None: print(f'   - {short(x)}')
        if y is not None: print(f'   + {short(y)}')
