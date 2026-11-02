#!/usr/bin/env python3
# scratch (SOUTHDOOR, from APPROACH's mutants.py): each mutant is applied to solverBot.js, its rows run, and the file restored byte for byte.
# Usage: python3 mutants.py <tree> [M1 M2 ...]   (default: all)
import hashlib, subprocess, sys

TREE = sys.argv[1]
ONLY = set(sys.argv[2:])
SB = f'{TREE}/frontend/modules/seedlingDemo/solverBot.js'
FAST = 'frontend/modules/seedlingDemo/hammerSouthDoor.test.js'
SLOW = 'frontend/modules/seedlingDemo/hammerSouthDoor.slow.test.js'
ON_ROW = 'ON, south of the latched door'

MUTANTS = {
    # drop the reorder: the approach never asks for its door (APPROACH's forks from (488,579))
    'M1-drop-reorder': ('    if (APPROACH_DOOR.enabled) {\n        const door = approachDoorFirst(',
                        '    if (false) {\n        const door = approachDoorFirst(', SLOW, ON_ROW),
    # order it when the staging is on the near side: the "a side plans" early answer is dropped
    'M2-near-side': ('    if (sides.some((s) => planWaypointsOrNull(run.world, run.state, s, null, opts) !== null)) return null;\n    const hypothesis',
                     '    const hypothesis', FAST, 'north of the door'),
    # skip the discharge: the door is named and noted, but no walk opens it
    'M3-skip-discharge': ('    ctx.walkTo(ctx.goal, row.cell, {', '    if (false) ctx.walkTo(ctx.goal, row.cell, {', SLOW, ON_ROW),
}

orig = open(SB, 'rb').read()
md5 = hashlib.md5(orig).hexdigest()
for name, (old, new, path, row) in MUTANTS.items():
    if ONLY and name.split('-')[0] not in ONLY and name not in ONLY:
        continue
    src = orig.decode()
    assert src.count(old) == 1, (name, src.count(old))
    open(SB, 'w').write(src.replace(old, new))
    try:
        cfg = ['--config', 'vitest.slow.config.js'] if '.slow.' in path else []
        p = subprocess.run(['npx', 'vitest', 'run', *cfg, path, '-t', row], cwd=TREE, capture_output=True, text=True,
                           timeout=3000)
        out = p.stdout + p.stderr
        red = [l.strip() for l in out.splitlines() if l.strip().startswith(('×', '✗', 'FAIL')) or ' failed' in l]
        print(f'{name}: exit {p.returncode} ({"RED" if p.returncode else "green — SURVIVED"})')
        for l in red[:6]:
            print('   ', l[:220])
        for l in out.splitlines():
            if 'AssertionError' in l or 'Expected' in l or 'Received' in l:
                print('   ', l.strip()[:220])
                break
    finally:
        open(SB, 'wb').write(orig)
    assert hashlib.md5(open(SB, 'rb').read()).hexdigest() == md5
print('restored', md5)
