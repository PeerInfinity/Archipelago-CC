# L100LATTICE: two survey logs, row by row (step, level, verdict line minus the wall-clock ms), and their counts.
import re, sys
def rows(p):
    out = {}
    for line in open(p, encoding='utf8', errors='replace'):
        m = re.match(r'== step (\d+) — (L\d+) \.\.\. (.*)$', line.rstrip('\n'))
        if m:
            out[int(m.group(1))] = (m.group(2), re.sub(r' — \d+ ms$', '', m.group(3)))
    return out
a, b = rows(sys.argv[1]), rows(sys.argv[2])
for name, r in (('A', a), ('B', b)):
    v = [x[1].split(' ')[0] for x in r.values()]
    print(name, len(r), 'steps:', {k: v.count(k) for k in sorted(set(v))})
common = sorted(set(a) & set(b))
moved = [s for s in common if a[s] != b[s]]
print('common', len(common), 'moved', len(moved))
for s in moved:
    print(f'step {s} {a[s][0]}\n  A: {a[s][1][:700]}\n  B: {b[s][1][:700]}')
