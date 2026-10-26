#!/usr/bin/env python3
"""SXC: two arms' census dirs -> seam-by-seam transitions over 5226..5270 (class X -> class Y), the seams that moved,
and which of them were band rows in the FIRST arm. Usage: sxc-transitions.py <from-dir> <to-dir>"""
import os, sys, re
from collections import Counter
# sxc-phases.py's loader and classifier (everything above its `--rows` branch), run once per arm dir
SRC = open(os.path.join(os.path.dirname(__file__), 'sxc-phases.py')).read().split("if '--rows' in sys.argv:")[0]
def load(d):
    g = {'__name__': 'lib'}
    saved = sys.argv; sys.argv = [saved[0], d]
    exec(compile(SRC, 'sxc-phases.py', 'exec'), g)
    sys.argv = saved
    return g
a_dir, b_dir = sys.argv[1], sys.argv[2]
g = load(a_dir); A = g['rows']; B = load(b_dir)['rows']
klass, isband = g['klass'], g['isband']
period = range(5226, 5271)
moves = Counter(); moved = []
for s in period:
    ka, kb = klass(A[s]), klass(B[s])
    same = (A[s]['ok'], A[s]['answer'], A[s]['work']) == (B[s]['ok'], B[s]['answer'], B[s]['work'])
    moves[(ka, kb, 'band' if isband(A[s]) else '')] += 1
    if not same: moved.append((s, s % 45, ka, kb, A[s]['work'], B[s]['work'], 'BAND-in-from' if isband(A[s]) else ''))
print(f'from {a_dir}\nto   {b_dir}')
print('transition counts over the period (from-class -> to-class [band in from]):')
for (ka, kb, bd), n in sorted(moves.items(), key=lambda x: -x[1]):
    print(f'- {n}x {ka}  ->  {kb}' + (f'   [{bd}]' if bd else '') + ('' if ka != kb else '   (class kept)'))
print(f'\nseams whose answer/work moved: {len(moved)}')
for m in moved: print('  ', *m, sep='\t')
