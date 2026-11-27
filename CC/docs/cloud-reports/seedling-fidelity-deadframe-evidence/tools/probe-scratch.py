#!/usr/bin/env python3
"""DEADFRAME (wave 66) D3 runtime probe at the ON branch — COPY + RESTORE, never committed (run in a worktree at the head).

  python3 probe-scratch.py apply <repo>     add counters (`globalThis.__DFP`, which nothing shipped sets)
  python3 probe-scratch.py restore <repo>   put the file back and check `git diff --quiet` on it

Counters (`__DFP.c`): queued (a dead-frame queue made), flushed (run), dropped (torn down / level changed), deadSteps
(dead-frame responder steps run), changedSteps (of those, steps on which a responder's open/alpha moved), enemyPress
(a FallRock arm an enemy made).
"""
import shutil, subprocess, sys, os
R = sys.argv[2]
F = os.path.join(R, 'frontend/modules/seedlingDemo/levelRun.js')
SAVE = F + '.probe-save'
C = "(globalThis.__DFP && (globalThis.__DFP.c[{k}] = (globalThis.__DFP.c[{k}] ?? 0) + ({v})))"
def c(k, v='1'): return C.format(k=repr(k), v=v)
EDITS = [
    ("            enemies: responderEnemiesNow(), why };\n    };", "            enemies: responderEnemiesNow(), why };\n        " + c('queued') + ";\n    };"),
    ("        if (p.level !== level || activatorStateFor(level) !== p.state) return;\n        const look =",
     "        if (p.level !== level || activatorStateFor(level) !== p.state) { " + c('dropped') + "; return; }\n        const look ="),
    ("        deadResponderFrames.push({ t: ticksCompleted, level, why: p.why, frames: p.frames.length, changed });",
     "        deadResponderFrames.push({ t: ticksCompleted, level, why: p.why, frames: p.frames.length, changed });\n        "
     + c('flushed') + "; " + c('deadSteps', 'p.frames.length') + "; " + c('changedSteps', 'changed') + ";"),
    ("        if (pendingButtonFalls !== null) enemyRockPresses.push(",
     "        if (pendingButtonFalls !== null) " + c('enemyPress') + ";\n        if (pendingButtonFalls !== null) enemyRockPresses.push("),
]
if sys.argv[1] == 'apply':
    shutil.copy2(F, SAVE); s = open(F).read()
    for a, b in EDITS:
        n = s.count(a)
        if n != 1: shutil.copy2(SAVE, F); sys.exit(f'anchor x{n}: {a[:60]!r}')
        s = s.replace(a, b)
    open(F, 'w').write(s); print('probe-scratch: applied', len(EDITS))
else:
    shutil.copy2(SAVE, F); os.remove(SAVE)
    r = subprocess.run(['git', '-C', R, 'diff', '--quiet', '--', F]); print('probe-scratch: restored;', 'clean' if r.returncode == 0 else 'NOT CLEAN')
