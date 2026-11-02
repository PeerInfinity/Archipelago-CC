#!/usr/bin/env python3
"""scratch (POCKET-BURN): apply each mutant to solverBot.js in a scratch worktree, run the fast rows, restore byte for byte.
Usage: mutants.py <worktree>"""
import subprocess, sys
W = sys.argv[1]; P = f'{W}/frontend/modules/seedlingDemo/solverBot.js'
MUT = {
    'M1 drop the burn offer': ('return STANCE_BURN.enabled ? stanceBurnPrerequisite(run, candidates, exempt, hypothesis, blocked) : null;', 'return null;'),
    'M2 offer it with no Fire held': ("if (!inv.hasFire || inv.hasFireWand || !executorFor('burn'", "if (inv.hasFireWand || !executorFor('burn'"),
    'M3 offer it past the strategy switch\'s gate': ("|| !executorFor('burn', 'stancePrerequisite:burn')) return [];", ') return [];'),
}
orig = open(P, encoding='utf8').read()
for name, (a, b) in MUT.items():
    assert orig.count(a) == 1, name
    open(P, 'w', encoding='utf8').write(orig.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerPocketBurn.test.js'], cwd=W, capture_output=True, text=True)
    out = r.stdout + r.stderr
    fails = [l.strip() for l in out.splitlines() if '×' in l or 'FAIL ' in l or 'AssertionError' in l]
    print(f'== {name}: exit {r.returncode}'); print('\n'.join(fails[:6]))
    open(P, 'w', encoding='utf8').write(orig)
assert open(P, encoding='utf8').read() == orig
print('restored byte for byte')
