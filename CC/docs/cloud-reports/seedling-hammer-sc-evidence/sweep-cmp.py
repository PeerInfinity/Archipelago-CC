#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sc D3): per-residue verdict + ticks, base vs admissible floor, for the L18 sweep and C2's
ghost staging (`r <n> <VERDICT> <ticks> …` rows). usage: sweep-cmp.py <base.out> <floorB.out>"""
import re, sys
def rows(p):
    out = {}
    for l in open(p):
        m = re.match(r'r\s*(\d+)\s+(\S+)\s+(\d+)?', l)
        if m: out[int(m.group(1))] = (m.group(2), int(m.group(3)) if m.group(3) else None, l.rstrip())
    return out
a, b = rows(sys.argv[1]), rows(sys.argv[2])
from collections import Counter
va = Counter(v[0] for v in a.values()); vb = Counter(v[0] for v in b.values())
print('residues', len(a), len(b), 'verdicts base', dict(va), 'floorB', dict(vb))
vm = [r for r in a if a[r][0] != b[r][0]]
print('verdict moved:', len(vm), [(r, a[r][0], b[r][0]) for r in vm])
d = [(r, a[r][1], b[r][1]) for r in a if a[r][0] == b[r][0] == 'SOLVE' and a[r][1] != b[r][1]]
print('same verdict, ticks moved:', len(d), 'shorter', sum(1 for x in d if x[2] < x[1]), 'longer', sum(1 for x in d if x[2] > x[1]))
sa = sum(a[r][1] for r in a if a[r][0] == 'SOLVE' and b[r][0] == 'SOLVE'); sb = sum(b[r][1] for r in a if a[r][0] == 'SOLVE' and b[r][0] == 'SOLVE')
print('sum ticks over both-solved', sa, '->', sb)
print('moves:', d[:45])
for r in vm: print(' A', a[r][2][:160]); print(' B', b[r][2][:160])
