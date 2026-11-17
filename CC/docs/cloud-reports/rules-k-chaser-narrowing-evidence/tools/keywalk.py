"""Key walk: every JSON path whose value differs between two files (a git rev:path or a file path)."""
import json, subprocess, sys
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
out = []
walk(load(sys.argv[1]), load(sys.argv[2]), '', out)
# --fold=<suffix>[,<suffix>]: count (not print) the paths ending in a suffix whose -/+ pair is the same everywhere
fold = [f for a in sys.argv[3:] if a.startswith('--fold=') for f in a[7:].split(',')]
print(f'{len(out)} difference(s)')
for f in fold:
    hit = [(p, a, b) for p, a, b in out if p.endswith('/' + f)]
    pairs = sorted({(json.dumps(a), json.dumps(b)) for _, a, b in hit})
    if hit: print(f'[folded] {len(hit)} x .../{f}: ' + '; '.join(f'{a} -> {b}' for a, b in pairs))
    out = [x for x in out if not x[0].endswith('/' + f)]
for p, a, b in out:
    s = lambda v: json.dumps(v)[:400]
    print(p); print('  -', s(a)); print('  +', s(b))
