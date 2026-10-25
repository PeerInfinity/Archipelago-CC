#!/usr/bin/env python3
"""SCRATCH (PKB): a census (l371-solve RESULT jsonl) over one hammer period plus an overlap -> phases solving of 45,
the class tally over one period (5226..5270), and the periodicity check on the overlap (s vs s+45).
Usage: phases.py <rows.jsonl> [lo=5226]"""
import json, sys, os
from collections import Counter
ns = {}
src = open(os.path.join(os.path.dirname(__file__), 'cls.py')).read().replace('\nmain()\n', '\n')
exec(compile(src, 'cls.py', 'exec'), ns)
cls = ns['cls']
rows = {}
for l in open(sys.argv[1]):
    r = json.loads(l); rows[r['seam']] = r
lo = int(sys.argv[2]) if len(sys.argv) > 2 else 5226
def klass(r):
    if r['ok']: return 'SOLVE'
    ps = {p['pass']: p for p in r['passes']}
    c = cls(ps['dashless'])
    return c.split(' (')[0] if c.startswith(('EXHAUSTED', 'paced', 'reboot')) else c
period = [s for s in range(lo, lo + 45) if s in rows]
assert len(period) == 45, f'missing seams: {sorted(set(range(lo, lo + 45)) - set(rows))}'
solves = [s for s in period if rows[s]['ok']]
print(f'phases solving: {len(solves)} of 45  (seams {solves})')
pairs = [(s, s + 45) for s in period if s + 45 in rows]
same = [p for p in pairs if (rows[p[0]]['answer'], rows[p[0]]['work']) == (rows[p[1]]['answer'], rows[p[1]]['work'])]
cls_same = [p for p in pairs if klass(rows[p[0]]) == klass(rows[p[1]]) and rows[p[0]]['work'] == rows[p[1]]['work']]
print(f'overlap pairs: {len(pairs)}; identical answer+units {len(same)}; same class+units {len(cls_same)}; differing {[p for p in pairs if p not in cls_same]}')
print(f'guards: shakeRefused total {sum(rows[s]["guards"]["shakeRefused"] for s in period)}, seams with shakeRefused>0 {sum(1 for s in period if rows[s]["guards"]["shakeRefused"])}')
for k, v in Counter(klass(rows[s]) for s in period).most_common():
    print(f'- {v}x {k}')
