#!/usr/bin/env python3
"""Measure-only (slice L371): two censuses over the same seams -> per seam the answer under A and under B, and the
class transition tally. The class of a seam is its best answer: SOLVE, else the dashless pass's refusal class.
Usage: transitions.py <A.jsonl> <B.jsonl> [from] [to]"""
import json, sys, os
from collections import Counter
ns = {}
src = open(os.path.join(os.path.dirname(__file__), 'cls.py')).read().replace('\nmain()\n', '\n')
exec(compile(src, 'cls.py', 'exec'), ns)
cls = ns['cls']
def load(f):
    out = {}
    for l in open(f):
        r = json.loads(l); out[r['seam']] = r
    return out
def klass(r):
    if r['ok']: return 'SOLVE'
    ps = {p['pass']: p for p in r['passes']}
    c = cls(ps['dashless'])
    return c.split(' (')[0] if c.startswith(('EXHAUSTED', 'paced', 'reboot')) else c
A, B = load(sys.argv[1]), load(sys.argv[2])
lo = int(sys.argv[3]) if len(sys.argv) > 3 else -10**9
hi = int(sys.argv[4]) if len(sys.argv) > 4 else 10**9
seams = sorted(s for s in A if s in B and lo <= s <= hi)
t = Counter((klass(A[s]), klass(B[s])) for s in seams)
print(f'{len(seams)} seams; A solves {sum(A[s]["ok"] for s in seams)}, B solves {sum(B[s]["ok"] for s in seams)}')
print('| A class | B class | seams |'); print('|---|---|---|')
for (a, b), n in sorted(t.items(), key=lambda x: -x[1]): print(f'| {a} | {b} | {n} |')
lost = [s for s in seams if A[s]['ok'] and not B[s]['ok']]
print('A-solve -> B-refusal seams:', lost)
