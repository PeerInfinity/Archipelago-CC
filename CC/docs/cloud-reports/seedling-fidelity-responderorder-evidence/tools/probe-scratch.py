#!/usr/bin/env python3
"""RESPONDERORDER's runtime probe at the ON branch — COPY + RESTORE, never committed (wave 64's scratch method).

  python3 probe-scratch.py apply     copy the two sources aside, then add counters (`globalThis.__RP`, which nothing
                                     shipped sets: unset, every edit is a no-op)
  python3 probe-scratch.py restore   copy them back and check `git diff --quiet` on both

Counters (`__RP.c`): steps (ON steps run), seeded (a world's first step), enemyPress (a step whose publish differs
because a spinner / wallflyer presses), enemyHold (a Lock-family reset held ONLY by an enemy box), deferred (steps
deferred), ranDeferred, staleDrop (a deferred step dropped: its world was torn down since), transitionDrop (a transition tick's
step not run), tapeEndPending (a step still pending when the probe reads at the end: past the last frame).
"""
import shutil, subprocess, sys, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..'))
D = os.path.join(ROOT, 'frontend/modules/seedlingDemo')
SAVE = os.environ.get('SCRATCH_SAVE', '/tmp/claude-0/responderorder-probe-save')
FILES = ['activators.js', 'levelRun.js']
C = "(globalThis.__RP && (globalThis.__RP.c[{k}] = (globalThis.__RP.c[{k}] ?? 0) + 1))"
def c(k): return C.format(k=repr(k))
EDITS = [
    ('activators.js', "        pressed = state.published;\n",
     "        pressed = state.published;\n        " + c('steps') + ";\n"),
    ('activators.js', "            presserHalfDone = true;\n",
     "            presserHalfDone = true;\n            " + c('seeded') + ";\n"),
    ('activators.js', "        state.published = pressedGroups(world, playerBox, pressers);\n    }\n    return events;",
     "        state.published = pressedGroups(world, playerBox, pressers);\n"
     "        if (globalThis.__RP && [...state.published].sort().join() !== [...pressedGroups(world, playerBox, movingSolids)].sort().join()) " + c('enemyPress') + ";\n"
     "    }\n    return events;"),
    ('activators.js', "            if (!occupied(a.rect, responder.guard === 'occupancy')) {",
     "            if (globalThis.__RP && !occupied(a.rect, false) && occupied(a.rect, responder.guard === 'occupancy')) " + c('enemyHold') + ";\n"
     "            if (!occupied(a.rect, responder.guard === 'occupancy')) {"),
    ('levelRun.js', "        pendingResponderStep = { level, state: activators, world: w };",
     "        pendingResponderStep = { level, state: activators, world: w };\n        " + c('deferred') + ";\n"
     "        if (globalThis.__RP) globalThis.__RP.pending = () => pendingResponderStep !== null;"),
    ('levelRun.js', "        pendingResponderStep = null;\n        if (p.level !== level || activatorStateFor(level) !== p.state) return;",
     "        pendingResponderStep = null;\n        " + c('ranDeferred') + ";\n        if (p.level !== level || activatorStateFor(level) !== p.state) { " + c('staleDrop') + "; return; }"),
    ('levelRun.js', "                    if (!next.transition) deferResponderStep(activators, world);",
     "                    if (!next.transition) deferResponderStep(activators, world);\n                    else " + c('transitionDrop') + ";"),
]
def apply():
    os.makedirs(SAVE, exist_ok=True)
    for f in FILES: shutil.copy2(os.path.join(D, f), os.path.join(SAVE, f))
    for f, a, b in EDITS:
        p = os.path.join(D, f); s = open(p).read(); n = s.count(a)
        if n != 1:
            restore(); sys.exit(f'probe-scratch: {f}: anchor found {n} times: {a[:70]!r}')
        open(p, 'w').write(s.replace(a, b))
    print('probe-scratch: applied', len(EDITS), 'edits; saved copies in', SAVE)
def restore():
    for f in FILES:
        src = os.path.join(SAVE, f)
        if os.path.exists(src): shutil.copy2(src, os.path.join(D, f))
    r = subprocess.run(['git', '-C', ROOT, 'diff', '--quiet', '--', *[os.path.join(D, f) for f in FILES]])
    print('probe-scratch: restored;', 'git diff clean' if r.returncode == 0 else 'GIT DIFF NOT CLEAN')
    if r.returncode != 0: sys.exit(1)
if __name__ == '__main__':
    {'apply': apply, 'restore': restore}[sys.argv[1]]()
