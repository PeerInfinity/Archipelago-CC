#!/usr/bin/env python3
# SCRATCH (seedling-hammer-wc D1): inclusive / self time per function (and per function under an ancestor) from a
# .cpuprofile. Each sample counts once per distinct function on its stack (recursion-safe).
#   prof.py <file.cpuprofile> [--under=<name>[:line]] [--top=N]
import json, sys, collections
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
p = json.load(open(args[0]))
nodes = {n['id']: n for n in p['nodes']}
parent = {}
for n in p['nodes']:
    for c in n.get('children', []):
        parent[c] = n['id']
def name(n):
    cf = n['callFrame']
    u = cf['url'].rsplit('/', 1)[-1]
    return f"{cf['functionName'] or '(anon)'}@{u}:{cf['lineNumber']+1}"
dt = collections.Counter()
samples = p['samples']; deltas = p['timeDeltas']
for s, d in zip(samples, deltas):
    dt[s] += d
under = opt.get('under')
incl = collections.Counter(); selft = collections.Counter(); total = 0; utotal = 0
for nid, t in dt.items():
    total += t
    stack = []
    x = nid
    while x is not None:
        stack.append(name(nodes[x])); x = parent.get(x)
    if under:
        hit = [i for i, s in enumerate(stack) if s.startswith(under)]
        if not hit:
            continue
        stack = stack[:hit[-1] + 1]
        utotal += t
    selft[stack[0]] += t
    for f in set(stack):
        incl[f] += t
top = int(opt.get('top', 40))
print(f"total {total/1e6:.1f}s" + (f"  under {under}: {utotal/1e6:.1f}s" if under else ''))
print('--- inclusive')
for f, t in incl.most_common(top):
    print(f"{t/1e6:8.2f}s  {f}")
print('--- self')
for f, t in selft.most_common(top):
    print(f"{t/1e6:8.2f}s  {f}")
