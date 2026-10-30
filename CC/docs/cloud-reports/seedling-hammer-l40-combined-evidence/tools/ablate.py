#!/usr/bin/env python3
# scratch (L40C): each arm's answers vs a base arm, by digest. Usage: ablate.py <dir> <base> <arm>...
import json, sys
sys.argv = [sys.argv[0], sys.argv[1]] + sys.argv[2:]
from table import data, cell, wall, goal
base, arms = sys.argv[2], sys.argv[3:]
B = data[base]
for a in arms:
    A = data[a]
    mv = [k for k in sorted(B) if A[k]['digest'] != B[k]['digest']]
    print(f'== {base} vs {a}: {len(mv)} mover(s); solved {sum(r["ok"] for r in B.values())} -> {sum(r["ok"] for r in A.values())}')
    for k in mv:
        print(f'  {k[0]}/{k[1]} {goal(B[k]["key"])}: {cell(B[k])} -> {cell(A[k])}')
        print(f'     {base}: {wall(B[k])[:220]}')
        print(f'     {a}: {wall(A[k])[:220]}')
