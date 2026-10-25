#!/usr/bin/env python3
"""SCRATCH (BX): per-seam transitions (class, units) between two census files over 5226..5270. Usage: trans.py a b"""
import json, sys
from collections import Counter
exec(open(__file__.replace('trans.py', 'bxphases.py')).read().split('rows = {}')[0])
a = {json.loads(l)['seam']: json.loads(l) for l in open(sys.argv[1])}
b = {json.loads(l)['seam']: json.loads(l) for l in open(sys.argv[2])}
c = Counter(); moved = []
for s in range(5226, 5271):
    ka, kb = klass(a[s]), klass(b[s])
    same = (a[s]['answer'], a[s]['work'], a[s]['ok']) == (b[s]['answer'], b[s]['work'], b[s]['ok'])
    c[(ka[:40], kb[:40], 'identical' if same else 'moved')] += 1
    if not same: moved.append((s, ka[:30], kb[:30], a[s]['work'], b[s]['work']))
for (x, y, z), n in sorted(c.items(), key=lambda t: -t[1]): print(f'| {x} | {y} | {z} | {n} |')
print('moved seams (period):', moved)
allmoved = [s for s in sorted(set(a) & set(b)) if (a[s]['answer'], a[s]['work'], a[s]['ok']) != (b[s]['answer'], b[s]['work'], b[s]['ok'])]
print('moved over all', len(set(a) & set(b)), 'seams:', allmoved)
