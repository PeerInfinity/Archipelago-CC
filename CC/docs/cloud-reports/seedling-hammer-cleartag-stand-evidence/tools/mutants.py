# MEASUREMENT ONLY: apply each mutant to solverBot.js in a separate worktree (argv[1]), run the new rows, restore.
import subprocess, sys, pathlib
wt = pathlib.Path(sys.argv[1]); f = wt / 'frontend/modules/seedlingDemo/solverBot.js'; orig = f.read_text()
M = {
  'M1 drop the tail (ON asks axisClearTagStand)': (
    '    return CLEARTAG_STAND.enabled ? clearTagKeylockStand(run, verb, resolved) : axisClearTagStand(run, verb, resolved);',
    '    return axisClearTagStand(run, verb, resolved);'),
  'M2 tail without the hold length': (
    '    if (verb !== \'keylock\' || !KEYLOCK_WAIT_PRICED.enabled) return {};\n    return keylockStandWalk(run, resolved);',
    '    if (verb !== \'keylock\' || !KEYLOCK_WAIT_PRICED.enabled) return {};\n    const t = keylockStandWalk(run, resolved);\n    return t.stand ? { stand: { keys: t.stand.keys } } : t;'),
  'M3 the switch ignored (the tail OFF too)': (
    '    return CLEARTAG_STAND.enabled ? clearTagKeylockStand(run, verb, resolved) : axisClearTagStand(run, verb, resolved);',
    '    return clearTagKeylockStand(run, verb, resolved);'),
  'M4 every verb (the keylock gate dropped)': (
    '    if (verb !== \'keylock\' || !KEYLOCK_WAIT_PRICED.enabled) return {};\n    return keylockStandWalk(run, resolved);',
    '    if (!KEYLOCK_WAIT_PRICED.enabled) return {};\n    return keylockStandWalk(run, resolved);'),
}
try:
  for name, (a, b) in M.items():
    assert orig.count(a) == 1, name
    f.write_text(orig.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerClearTagStand.test.js'], cwd=wt, capture_output=True, text=True)
    fails = [l.strip() for l in r.stdout.splitlines() if '×' in l or 'FAIL' in l]
    print(f"{name}: {'RED' if r.returncode else 'GREEN (SURVIVED)'}  {' | '.join(fails)[:400]}", flush=True)
finally:
  f.write_text(orig)
