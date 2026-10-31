# AXIS mutants: copy solverBot.js, apply one edit, run hammerAxisStrikes.test.js, restore. Usage: python3 mutants.py <tree>
import subprocess, sys, shutil
TREE = sys.argv[1]
F = f'{TREE}/frontend/modules/seedlingDemo/solverBot.js'
MUT = [
    ('M1 aim off-axis (the offer keeps the bodies whose facing is OFF the axis)',
     "along = bodies.filter((b) => AXIS_OF_FACING[facingToward(state, b.rect)] === axis);",
     "along = bodies.filter((b) => AXIS_OF_FACING[facingToward(state, b.rect)] !== axis);"),
    ('M2 the lane drifts (at rest the axis is not asked: every body offered, an aim across the lane from rest)',
     "        if (axis === null) {\n            if (bodies.length > 0) AXIS_STRIKE_COUNTS.noAxis += 1;",
     "        if ((state.vx ?? 0) === 0 && (state.vy ?? 0) === 0) {\n            along = bodies;\n        } else if (axis === null) {\n            if (bodies.length > 0) AXIS_STRIKE_COUNTS.noAxis += 1;"),
    ('M2b the press adds a perpendicular key (`down`) — expected to be absorbed by holdOneAxis while moving',
     "            const out = policy.decide(state, bodies, tick, walkHeld, opts);\n            if (out.decision === STRIKE_PRESS) AXIS_STRIKE_COUNTS.pressed += 1;\n            return out;",
     "            const out = policy.decide(state, bodies, tick, walkHeld, opts);\n            if (out.decision === STRIKE_PRESS) AXIS_STRIKE_COUNTS.pressed += 1;\n            return { ...out, held: new Set([...out.held, 'down']) };"),
    ('M3 drop the arm (axisStrikeFor always null)',
     "    return AXIS_STRIKE.enabled ? strikePolicyFor(run, { dashMode, axisAlong: true }) : null;",
     "    return null;"),
]
orig = open(F).read()
try:
    for name, a, b in MUT:
        assert orig.count(a) == 1, name
        open(F, 'w').write(orig.replace(a, b))
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerAxisStrikes.test.js'],
                           cwd=TREE, capture_output=True, text=True, timeout=900)
        out = r.stdout + r.stderr
        tests = [l.strip() for l in out.split('\n') if 'Tests ' in l]
        failed = sorted({l.split('>')[-1].strip()[:110] for l in out.split('\n') if 'FAIL' in l and '>' in l})
        print(f'{name}\n  -> {"RED" if r.returncode else "GREEN (survives)"} | {tests[-1] if tests else "?"}')
        for f in failed: print(f'     red row: {f}')
finally:
    open(F, 'w').write(orig)
print('restored:', open(F).read() == orig)
