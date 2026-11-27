#!/usr/bin/env python3
"""DEADFRAME2 (wave 69) D3 runtime probe at the ON branch — COPY + RESTORE, never committed.

  python3 probe2-scratch.py apply <repo>     add counters (`globalThis.__DFP2`, which nothing shipped sets)
  python3 probe2-scratch.py restore <repo>   put the file back and check `git diff --quiet` on it

Counters (`__DFP2.c`): `pq:<kind>` Pulser queues made per kind, `pflush` run, `pdrop` dropped (torn down),
`pframes` Pulser dead frames stepped, `phits` dead-frame hits, `pchanged` frames that moved a Pulser's state;
`squeued` seal-piece responder queues, `schanged` their frames that moved a responder; `bpress` block FallRock arms.
"""
import shutil, subprocess, sys, os
R = sys.argv[2]
F = os.path.join(R, 'frontend/modules/seedlingDemo/levelRun.js')
SAVE = F + '.probe2-save'
C = "(globalThis.__DFP2 && (globalThis.__DFP2.c[{k}] = (globalThis.__DFP2.c[{k}] ?? 0) + ({v})))"
def c(k, v='1'): return C.format(k=k, v=v)
EDITS = [
    ("        pendingDeadPulserFrames.push({ t: ticksCompleted, level, state: st, n, why });\n",
     "        pendingDeadPulserFrames.push({ t: ticksCompleted, level, state: st, n, why });\n        " + c("'pq:' + String(why).replace(/ .*$/, '')") + ";\n"),
    ("            if (q.level !== level || pulserStateFor(level) !== q.state) continue;\n            const r = stepPulsersFrozenNow(activators, q.n, q.why);\n",
     "            if (q.level !== level || pulserStateFor(level) !== q.state) { " + c("'pdrop'") + "; continue; }\n            const r = stepPulsersFrozenNow(activators, q.n, q.why);\n            "
     + c("'pflush'") + "; " + c("'pframes'", 'q.n') + "; " + c("'phits'", 'r?.hits ?? 0') + "; " + c("'pchanged'", 'r?.changed ?? 0') + ";\n"),
    ("            frames: Array.from({ length: n }, () => solids), enemies: responderEnemiesNow(), why };\n",
     "            frames: Array.from({ length: n }, () => solids), enemies: responderEnemiesNow(), why };\n        " + c("'squeued'") + ";\n"),
    ("        deadResponderFrames.push({ t: ticksCompleted, level, why: p.why, frames: p.frames.length, changed });\n",
     "        deadResponderFrames.push({ t: ticksCompleted, level, why: p.why, frames: p.frames.length, changed });\n        if (String(p.why).startsWith('sealpiece')) " + c("'schanged'", 'changed') + ";\n"),
    ("        if (pendingButtonFalls !== null) blockRockPresses.push(",
     "        if (pendingButtonFalls !== null) " + c("'bpress'") + ";\n        if (pendingButtonFalls !== null) blockRockPresses.push("),
]
if sys.argv[1] == 'apply':
    shutil.copy2(F, SAVE); s = open(F).read()
    for a, b in EDITS:
        n = s.count(a)
        if n != 1: shutil.copy2(SAVE, F); sys.exit(f'anchor x{n}: {a[:60]!r}')
        s = s.replace(a, b)
    open(F, 'w').write(s); print('probe2-scratch: applied', len(EDITS))
else:
    shutil.copy2(SAVE, F); os.remove(SAVE)
    r = subprocess.run(['git', '-C', R, 'diff', '--quiet', '--', F]); print('probe2-scratch: restored;', 'clean' if r.returncode == 0 else 'NOT CLEAN')
