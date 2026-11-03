#!/usr/bin/env python3
"""scratch (BK2COMBAT, from POCKET-BURN's): apply each mutant to solverBot.js in a scratch worktree, run the named rows
(fast: hammerBk2Combat.test.js; slow: the shut-pocket ON row of hammerBk2Combat.slow.test.js), restore byte for byte.
Usage: mutants.py <worktree>"""
import subprocess, sys
W = sys.argv[1]; P = f'{W}/frontend/modules/seedlingDemo/solverBot.js'
FAST = ['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerBk2Combat.test.js']
SLOW = ['npx', 'vitest', 'run', '--config', 'vitest.slow.config.js', 'frontend/modules/seedlingDemo/hammerBk2Combat.slow.test.js',
        '-t', 'pocket shut, OPP, ON']
MUT = {
    'M1 drop the fix (the arm\'s first answer is final)': (
        '? stagedChaserHunt(hunted, firstHunt, { goal, aim, contacts, allowTeleporter, what }) : firstHunt;',
        '? firstHunt : firstHunt;', SLOW),
    'M2 no still wait (ask once, on arrival at the staging cell)': (
        'for (let d = 0; d <= cell.ceiling; d += 1) {', 'for (let d = 0; d <= 0; d += 1) {', SLOW),
    'M3 stage on every refused cell (a danger-refused one too)': (
        "rejected.filter((r) => r.wait === true)", "rejected.filter((r) => r.x !== undefined)", FAST),
    'M4 drive one still tick fewer than the fork priced': (
        'for (let k = 0; k < found; k += 1) {', 'for (let k = 1; k < found; k += 1) {', SLOW),
}
orig = open(P, encoding='utf8').read()
for name, (a, b, cmd) in MUT.items():
    assert orig.count(a) == 1, name
    open(P, 'w', encoding='utf8').write(orig.replace(a, b))
    r = subprocess.run(cmd, cwd=W, capture_output=True, text=True)
    out = r.stdout + r.stderr
    fails = [l.strip() for l in out.splitlines() if '×' in l or 'FAIL ' in l or 'AssertionError' in l or 'Expected' in l]
    print(f'== {name}: exit {r.returncode}', flush=True); print('\n'.join(fails[:8]), flush=True)
    open(P, 'w', encoding='utf8').write(orig)
assert open(P, encoding='utf8').read() == orig
print('restored byte for byte')
