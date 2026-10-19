#!/usr/bin/env python3
"""SCRATCH (seedling-fidelity-digest D3): EX's lab (make-lab.py, applied first) plus the digest: every pressEscape
record gains `dg` (run.stateDigest()), `dgp` (its components), `dgMs` (its own wall clock, outside the escape's `ms`)
and, every EX_LAB_FRESH-th call, `dgFresh` (the digest with every world re-hashed).
usage: make-lab-digest.py <solverBot.js>   (after make-lab.py; refuses the tracked tree)"""
import sys
p = sys.argv[1]
assert '/scratchpad/' in p, p
s = open(p).read()
old = """            const world = h(ser({ level: run.level, n: run.ticksCompleted, live: run.entities('spinnerBodies'),
                st: run.state, gt: run.gameTime }));"""
assert s.count(old) == 1
s = s.replace(old, old + """
            const dgT0 = globalThis.performance.now();
            const dgAll = run.stateDigest({ parts: true });
            const dgMs = globalThis.performance.now() - dgT0;
            counters.calls = (counters.calls ?? 0) + 1;
            const every = Number(globalThis.process.env.EX_LAB_FRESH ?? 0);
            const dgFresh = every > 0 && counters.calls % every === 0 ? run.stateDigest({ fresh: true }) : null;""")
old2 = """                cell: opts.labCell ? [opts.labCell.x, opts.labCell.y] : null, args, globals, world,"""
assert s.count(old2) == 1
s = s.replace(old2, old2 + """
                dg: dgAll.digest, dgp: dgAll.parts, dgMs: Math.round(dgMs * 1000) / 1000, dgFresh,""")
open(p, 'w').write(s)
print('digest lab applied', p)
