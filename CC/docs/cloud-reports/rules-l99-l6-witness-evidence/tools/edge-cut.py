#!/usr/bin/env python3
"""rules-l99-l6-witness: which regions become unreachable from Menu when ONE entrance is cut, everything else open
(every item rule read as satisfied: a graph-only upper bound, not a sphere computation).
Usage: python3 edge-cut.py <rules.json> "<entrance name>" [...]"""
import json, sys
from collections import deque
d = json.load(open(sys.argv[1]))
regs = d['regions']; regs = regs.get('1', regs)
def reach(cut):
    seen = {'Menu'}; q = deque(['Menu'])
    while q:
        r = q.popleft()
        for e in (regs.get(r) or {}).get('exits', []):
            if e.get('name') in cut: continue
            t = e.get('connected_region') or e.get('target') or e['name'].split(' -> ')[-1]
            if t not in seen: seen.add(t); q.append(t)
    return seen
full = reach(set())
for cut in sys.argv[2:]:
    lost = sorted(full - reach({cut}))
    print(json.dumps({'rules': sys.argv[1].split('/')[2], 'cut': cut, 'reachable_before': len(full), 'lost': lost}))
