#!/usr/bin/env python3
# scratch (NEW-LOCKS I): each mutant reverts one piece of the three switches in a scratch worktree and runs the
# slice's two test files there; a mutant is RED when a row fails. Usage: mutants.py <worktree> <out.txt>
import subprocess, sys
wt, out = sys.argv[1], sys.argv[2]
ONLY = sys.argv[3].split(',') if len(sys.argv) > 3 else None
P = wt + '/frontend/modules/seedlingDemo/solverBot.js'
orig = open(P, encoding='utf-8', errors='surrogateescape').read()
M = [
 ('M1 the clear-tag never reads the kill-lock write',
  "            if (!KILLLOCK_CLEAR_WRITE.enabled) return null;", "            if (KILLLOCK_CLEAR_WRITE.enabled || true) return null;"),
 ('M2 the write is read from any scratch row of the flag (the lock id not asked)',
  "c.tag === flag.tag && c.lock === id);", "c.tag === flag.tag);"),
 ('M3 no solid:rocklock row',
  "'solid:rocklock', () => (ROCKLOCK_KILL.enabled ? 'hold' : undefined)", "'solid:rocklock', () => (undefined)"),
 ('M4 the rocklock instance is never a kill-lock (refineStrategy / resolveKillStrategy get no row)',
  "    if (!solid) return null;\n    return { id: obstacle.id, tag: k.tag, t: KILL_LOCK_TSET,", "    if (solid || !solid) return null;\n    return { id: obstacle.id, tag: k.tag, t: KILL_LOCK_TSET,"),
 ('M5 a rocklock is read as gone at once (killLockStands has no solid arm)',
  "    return ROCKLOCK_KILL.enabled && lock.tag === 'rocklock'\n", "    return false && lock.tag === 'rocklock'\n"),
 ('M6 a pinned body is still asked the scan and waited for (chaserPinnedFromHere false)',
  "    return !chaserLineClear(run, body, run.world.solidBoxesForMover(run.liveGeometryOpts(), body.id), run.state);", "    return false;"),
 ('M7 no line test (every leash cell is a line stance)',
  "            if (!chaserLineClear(run, body, solids, { x, y })) continue;", ""),
 ('M8 line stances farthest from the player first',
  "    cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);\n    return cells.map(({ x, y }) => ({ x, y }));", "    cells.sort((a, b) => b.d - a.d || a.y - b.y || a.x - b.x);\n    return cells.map(({ x, y }) => ({ x, y }));"),
 ('M9 no standoff (cells inside the sword reach of the body are offered)',
  "            if (distanceRectPoint(x, y, body.rect) <= SLASH_REACH) continue;\n            if (plannerObstacleAt(run.world, x, y, null, opts) !== null) continue;\n            if (!chaserLineClear", "            if (plannerObstacleAt(run.world, x, y, null, opts) !== null) continue;\n            if (!chaserLineClear"),
 ('M10 one line stance a body (PER_BODY 1)',
  "export const KILLLOCK_LINE_STANCE_PER_BODY = 3;", "export const KILLLOCK_LINE_STANCE_PER_BODY = 1;"),
 ('M11 no line-stance turn (the queue is never built)',
  "    for (const b of live) {\n        const cells = chaserLineStances(run, b, contacts);", "    for (const b of []) {\n        const cells = chaserLineStances(run, b, contacts);"),
 ('M12 the point line, not the box sweep (the body is a point)',
  "        const box = chaserBoxAt(body.tag, body.x + (to.x - body.x) * (i / n), body.y + (to.y - body.y) * (i / n));",
  "        const bx = body.x + (to.x - body.x) * (i / n); const by = body.y + (to.y - body.y) * (i / n);\n        const box = { x: bx, y: by, w: 1, h: 1, right: bx + 1, bottom: by + 1 };"),
]
lines = []
for name, a, b in M:
    if ONLY and name.split()[0] not in ONLY: continue
    assert orig.count(a) == 1, (name, orig.count(a))
    open(P, 'w', encoding='utf-8', errors='surrogateescape').write(orig.replace(a, b))
    red = []
    for cfg, f in (([], 'frontend/modules/seedlingDemo/hammerNewLocks.test.js'), (['--config', 'vitest.train.config.js'], 'frontend/modules/seedlingDemo/hammerNewLocks.train.test.js')):
        r = subprocess.run(['npx', 'vitest', 'run', *cfg, f], cwd=wt, capture_output=True, text=True)
        for l in r.stdout.splitlines():
            if '×' in l: red.append(l.strip()[:150])
    lines.append(f"{name}: {'RED (' + str(len(red)) + ' row(s))' if red else 'SURVIVED'}")
    lines += ['    ' + l for l in red]
    open(out, 'w').write('\n'.join(lines) + '\n')
open(P, 'w', encoding='utf-8', errors='surrogateescape').write(orig)
