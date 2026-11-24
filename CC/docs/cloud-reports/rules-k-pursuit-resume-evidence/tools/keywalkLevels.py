"""Bucket a key walk (keywalk.py's differences) by level: the first level_N named in the PATH (a region / sidecar key),
else in the old/new VALUES. Prints per level the number of changed paths, and lists any path that names no level."""
import json, re, subprocess, sys, collections
def load(spec):
    if ':' in spec and not spec.startswith('/'):
        return json.loads(subprocess.check_output(['git', 'show', spec]))
    return json.load(open(spec))
def walk(a, b, p, out):
    if type(a) != type(b): out.append((p, a, b)); return
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b), key=str):
            if k not in a: out.append((f'{p}/{k}', '<absent>', b[k]))
            elif k not in b: out.append((f'{p}/{k}', a[k], '<absent>'))
            else: walk(a[k], b[k], f'{p}/{k}', out)
    elif isinstance(a, list):
        if len(a) != len(b): out.append((p, f'len {len(a)}', f'len {len(b)}'))
        for i, (x, y) in enumerate(zip(a, b)): walk(x, y, f'{p}/{i}', out)
    elif a != b: out.append((p, a, b))
a, b = load(sys.argv[1]), load(sys.argv[2])
out = []
walk(a, b, '', out)
# FOLDED: the atlas id stamp (every sidecar's atlas_ref and the document's atlas_id) and the sphere log's region lists,
# which are compared as SETS (a list index shifts when a region is inserted); printed as counts / set differences.
stamp = [x for x in out if x[0].endswith('/atlas_ref') or x[0].endswith('/atlas_id')]
print(f'[folded] {len(stamp)} atlas-id stamp path(s): ' + '; '.join(sorted({f'{x[1]} -> {x[2]}' for x in stamp})))
sl = sorted({re.sub(r'/\d+$', '', x[0]) for x in out if x[0].startswith('/sphere_log/')})
for q in sl:
    node = lambda d: __import__('functools').reduce(lambda o, k: o[int(k)] if isinstance(o, list) else o[k], q.strip('/').split('/'), d)
    A, B = set(node(a)), set(node(b))
    print(f'[folded] {q} as a set: -{sorted(A - B)} +{sorted(B - A)}')
out = [x for x in out if x not in stamp and not x[0].startswith('/sphere_log/')]
by = collections.Counter(); none = []
for p, x, y in out:
    m = re.search(r'level_(\d+)', p) or re.search(r'level_(\d+)', json.dumps(x)[:2000] + json.dumps(y)[:2000])
    if m: by[int(m.group(1))] += 1
    else: none.append(p)
print(f'{len(out)} changed path(s); levels: ' + ', '.join(f'L{k}:{v}' for k, v in sorted(by.items())))
print(f'{len(none)} path(s) naming no level' + ''.join(f'\n  {p}' for p in none[:40]))
show = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else []
for p, x, y in out:
    m = re.search(r'level_(\d+)', p) or re.search(r'level_(\d+)', json.dumps(x)[:2000] + json.dumps(y)[:2000])
    if m and int(m.group(1)) in show: print(p, '\n   -', json.dumps(x)[:300], '\n   +', json.dumps(y)[:300])
