#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-cross-pass-cache D1): after make-lab.py + make-lab-digest.py — every record gains `dga`
(run.stateDigest() AFTER the call: a call that moved it built a lazy visit state and could not be replayed without
it), `xg` (the solver-side globals DIGEST's D4 adds: HAMMER_ESCAPE_BOUNDS, PRESS_KILL_COST.enabled) and `dgaMs`.
usage: make-lab-xc.py <solverBot.js>   (refuses the tracked tree)"""
import sys
p = sys.argv[1]
assert '/scratchpad/' in p, p
s = open(p).read()
old = """            const ms = globalThis.performance.now() - t0;"""
assert s.count(old) == 1
s = s.replace(old, old + """
            const dgaT0 = globalThis.performance.now();
            const dga = run.stateDigest();
            const dgaMs = globalThis.performance.now() - dgaT0;
            const xg = h(ser({ b: HAMMER_ESCAPE_BOUNDS, pk: PRESS_KILL_COST.enabled }));""")
old2 = """                dg: dgAll.digest, dgp: dgAll.parts, dgMs: Math.round(dgMs * 1000) / 1000, dgFresh,"""
assert s.count(old2) == 1
s = s.replace(old2, old2 + """
                dga, dgaMs: Math.round(dgaMs * 1000) / 1000, xg,""")
open(p, 'w').write(s)
print('xc lab applied', p)
