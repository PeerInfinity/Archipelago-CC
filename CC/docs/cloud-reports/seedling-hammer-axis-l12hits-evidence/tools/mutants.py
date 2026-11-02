# MEASUREMENT ONLY: each mutant edits a copy-tree's solverBot.js, runs hammerAxisStrikes.test.js, restores.
import subprocess, sys, re
root = sys.argv[1]
p = root + '/frontend/modules/seedlingDemo/solverBot.js'
orig = open(p).read()
GATE = "    if (!AXIS_STRIKE.enabled || verb !== 'keylock' || !KEYLOCK_WAIT_PRICED.enabled) return {};\n    return keylockStandWalk(run, resolved);\n"
CALL = "                ...axisClearTagStand(run, verb, resolved),\n"
M = {
    'M1 remove the fix (the tail never handed)': (GATE, "    return {};\n"),
    'M2 drop the call at the clear-tag site': (CALL, ""),
    'M3 OFF too (the AXIS_STRIKE gate dropped)': (GATE, "    if (verb !== 'keylock' || !KEYLOCK_WAIT_PRICED.enabled) return {};\n    return keylockStandWalk(run, resolved);\n"),
    'M4 every verb (the keylock gate dropped)': (GATE, "    if (!AXIS_STRIKE.enabled || !KEYLOCK_WAIT_PRICED.enabled) return {};\n    return keylockStandWalk(run, resolved);\n"),
}
for name, (a, b) in M.items():
    assert orig.count(a) == 1, name
    open(p, 'w').write(orig.replace(a, b))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerAxisStrikes.test.js'], cwd=root,
                           capture_output=True, text=True, timeout=900)
        out = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
        tests = [l.strip() for l in out.splitlines() if re.match(r'\s*Tests\s', l)]
        failed = sorted(set(re.findall(r'(?:×|FAIL)\s+.*?> (.*?)(?:\s+\d+ms)?$', out, re.M)))
        print(f"{name}: {'RED' if r.returncode else 'GREEN'} | {tests[-1] if tests else '?'} | {failed}")
    finally:
        open(p, 'w').write(orig)
