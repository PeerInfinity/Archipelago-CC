#!/usr/bin/env python3
# scratch (APPROACH): each mutant is applied to solverBot.js, its rows run, and the file restored byte for byte.
# Usage: python3 mutants.py <tree> [M1 M2 ...]   (default: all)
import hashlib, subprocess, sys

TREE = sys.argv[1]
ONLY = set(sys.argv[2:])
SB = f'{TREE}/frontend/modules/seedlingDemo/solverBot.js'
FAST = 'frontend/modules/seedlingDemo/hammerTurretApproach.test.js'
SLOW = 'frontend/modules/seedlingDemo/hammerTurretApproach.slow.test.js'
ON_ROW = 'ON: the approach is timed'

MUTANTS = {
    # drop the timing: no wait inside the range (the approach walks straight on)
    'M1-drop-timing': ('            for (let w = 0; w <= TURRET_APPROACH_WAIT_MAX; w += 1) {',
                       '            for (let w = 0; w <= 0; w += 1) {', SLOW, ON_ROW),
    # time it one turret cycle late: every wait is one volley cycle (45 ticks) longer
    'M2-cycle-late': ('                    for (let i = 0; i < w && ok; i += 1) ok = step(NONE_KEYS);',
                      '                    for (let i = 0; i < w + 45 && ok; i += 1) ok = step(NONE_KEYS);', SLOW, ON_ROW),
    # let the fifth order re-count a succeeded order
    'M3-recount': ('        && !applied.includes(next);', '        && true;', FAST, 'the fifth order'),
    # drop the snap
    'M4-drop-snap': ('    return TURRET_APPROACH.enabled ? iceTurretSnappedRect(t) : t.rect;', '    return t.rect;', FAST,
                     'the ctor box'),
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
