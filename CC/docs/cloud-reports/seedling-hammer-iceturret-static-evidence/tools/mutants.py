#!/usr/bin/env python3
"""ICEST mutants: apply each (file, old, new) edit, run hammerIceTurretStatic.test.js, record the red rows, restore."""
import re, subprocess, sys
ROOT = '/home/user/Archipelago-CC'
D = ROOT + '/frontend/modules/seedlingDemo/'
MUTANTS = [
    ('M1 drop the arm', D + 'solverBot.js',
     "if (target && target.iceTurret === true && ICETURRET_STATIC_KILL.enabled) {",
     "if (false && target && target.iceTurret === true && ICETURRET_STATIC_KILL.enabled) {"),
    ('M2 hand the arm a turret it cannot reach (an id no run steps)', D + 'solverBot.js',
     "done = killIceTurretOnWalk(run, perTick, target.id, contacts,",
     "done = killIceTurretOnWalk(run, perTick, `${target.id}#unreachable`, contacts,"),
    ('M2b the side off the UNSNAPPED box (a stance inside the live body)', D + 'solverBot.js',
     "    const r = { ...t.rect, x: t.rect.x + sx, right: t.rect.right + sx, y: t.rect.y + sy, bottom: t.rect.bottom + sy };\n    const at = ",
     "    const r = t.rect;\n    const at = "),
    ('M3 treat the corpse as gone (removed on the death tick)', D + 'iceTurret.js',
     "    state.dead = true;\n",
     "    state.dead = true;\n    state.removed = true;\n"),
]
out = []
for name, path, old, new in MUTANTS:
    src = open(path).read()
    if src.count(old) != 1:
        out.append(f'{name}: ANCHOR {src.count(old)} — not run'); continue
    open(path, 'w').write(src.replace(old, new))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerIceTurretStatic.test.js'],
                           cwd=ROOT, capture_output=True, text=True, timeout=900)
        txt = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
        red = sorted(set(m.strip() for m in re.findall(r'^\s*×\s*(.+?)(?:\s+\d+ms)?$', txt, re.M)))
        tests = re.findall(r'Tests\s+(.*)', txt)
        out.append(f'{name}: {tests[-1] if tests else "?"}' + ''.join(f'\n    RED: {x}' for x in red))
    finally:
        open(path, 'w').write(src)
print('\n'.join(out))
