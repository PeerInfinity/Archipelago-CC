"""Key walk of a preset rules.json against its base (git show <rev>:<path>): ADD/DEL/CHG per JSON path, grouped by level.
Usage: python3 -I keywalk.py <rev> <path> [<path> ...]"""
import json, re, subprocess, sys
from collections import defaultdict

def walk(o, p, out):
    if isinstance(o, dict):
        for k, v in o.items():
            walk(v, p + (str(k),), out)
    elif isinstance(o, list):
        # key lists of named objects by name, others by index
        if o and all(isinstance(x, dict) and 'name' in x for x in o):
            for x in o:
                walk(x, p + ('[' + str(x['name']) + ']',), out)
        else:
            for i, x in enumerate(o):
                walk(x, p + ('#' + str(i),), out)
    else:
        out['/'.join(p)] = o

def levels_of(path):
    return sorted({int(m) for m in re.findall(r'(?:level_|Level 0*)(\d+)', path)})

rev = sys.argv[1]
for path in sys.argv[2:]:
    base = json.loads(subprocess.run(['git', 'show', f'{rev}:{path}'], capture_output=True, text=True, check=True).stdout)
    tip = json.load(open(path))
    a, b = {}, {}
    walk(base, (), a); walk(tip, (), b)
    rows = []
    for k in sorted(set(a) | set(b)):
        if k not in b: rows.append(('DEL', k, a[k], None))
        elif k not in a: rows.append(('ADD', k, None, b[k]))
        elif a[k] != b[k]: rows.append(('CHG', k, a[k], b[k]))
    by = defaultdict(lambda: defaultdict(int))
    for op, k, _, _ in rows:
        lv = levels_of(k)
        by[','.join(f'L{x}' for x in lv) or '(no level)'][op] += 1
    print(f'== {path}: {len(rows)} path(s) moved')
    for lv, ops in sorted(by.items()):
        print(f'   {lv:24s} ' + ' '.join(f'{o} {n}' for o, n in sorted(ops.items())))
    if '--verbose' in sys.argv[:2] or len(rows) <= 0:
        pass
    import os
    with open(os.path.join(os.environ.get('OUT', '.'), path.replace('frontend/presets/', '').replace('/', '_') + '.keywalk.txt'), 'w') as f:
        for op, k, x, y in rows:
            f.write(f'{op} {k} : {json.dumps(x)} -> {json.dumps(y)}\n')
