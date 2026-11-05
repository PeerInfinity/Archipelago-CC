# MEASUREMENT ONLY: one mutant at a time in the scratch worktree's solverBot.js; the default-tier L95 file and the
# train row; restore after each.
import subprocess, sys, re
WT = sys.argv[1]; F = WT + '/frontend/modules/seedlingDemo/solverBot.js'; orig = open(F).read()
M = {
 'M1 the staged hunt never asked (returns the arm\'s first answer)': ('        if (!fork || !rewind) return first;', '        return first;'),
 'M2 `waits` kept with the switch OFF (the gate dropped on `waits`)': ('            ...(CHASER_STAGED_HUNT.enabled ? { waits: rejected.filter', '            ...(true ? { waits: rejected.filter'),
 'M3 the staging order reversed (farthest from the body first)': ('const cells = [...first.waits].sort((a, b) => a.d - b.d ||', 'const cells = [...first.waits].sort((a, b) => b.d - a.d ||'),
 'M4 hit cells offered as staging too': ("            rejected.push({ ...c, why: `${danger.phase === 'dwell' ? 'the WAIT' : 'the APPROACH'} `",
   "            rejected.push({ ...c, ...(CHASER_STAGED_HUNT.enabled ? { wait: true, ceiling: ceilingFor(c) } : {}), why: `${danger.phase === 'dwell' ? 'the WAIT' : 'the APPROACH'} `"),
}
def run(args):
    out = subprocess.run(['npx', 'vitest', 'run', *args, '--reporter=verbose'], cwd=WT, capture_output=True, text=True).stdout
    out = re.sub(r'\x1b\[[0-9;]*m', '', out)
    red = [re.sub(r'^.*> ', '', l).strip()[:70] for l in out.splitlines() if re.search(r'^\s*×', l)]
    tot = [l.strip() for l in out.splitlines() if re.search(r'^\s*Tests\s', l)]
    return red, (tot[-1] if tot else '?')
for n, (a, b) in M.items():
    assert orig.count(a) == 1, n
    open(F, 'w').write(orig.replace(a, b))
    r1, t1 = run(['frontend/modules/seedlingDemo/hammerL95Puncher.test.js'])
    r2, t2 = run(['--config', 'vitest.train.config.js', 'frontend/modules/seedlingDemo/hammerL95Puncher.train.test.js'])
    verdict = 'RED' if (r1 or r2) else 'GREEN (survived)'
    print(f'{n}: {verdict} — default tier: {t1}; train: {t2}')
    for x in r1: print('   red (default):', x)
    for x in r2: print('   red (train):', x)
open(F, 'w').write(orig)
