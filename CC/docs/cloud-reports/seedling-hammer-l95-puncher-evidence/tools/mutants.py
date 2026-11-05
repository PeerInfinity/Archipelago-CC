# MEASUREMENT ONLY: apply one mutant to the scratch worktree's solverBot.js, run the L95 rows, restore.
import subprocess, sys, shutil
WT = sys.argv[1]; F = WT + '/frontend/modules/seedlingDemo/solverBot.js'
MUT = {
  'M1 the staged hunt never asked (returns the arm\'s first answer)': ('        if (!fork || !rewind) return first;', '        return first;'),
  'M2 the staging cells kept with the switch OFF (the gate dropped on `waits`)': ('            ...(CHASER_STAGED_HUNT.enabled ? { waits: rejected.filter', '            ...(true ? { waits: rejected.filter'),
  'M3 the staging order reversed (farthest from the body first)': ('const cells = [...first.waits].sort((a, b) => a.d - b.d ||', 'const cells = [...first.waits].sort((a, b) => b.d - a.d ||'),
  'M4 the hit cells offered as staging too (every refused cell a wait)': ("                + 'own travel time plus three kill windows',", "                + 'own travel time plus three kill windows',\n"),
}
orig = open(F).read()
for name, (a, b) in MUT.items():
    if name.startswith('M4'):
        a = "            rejected.push({ ...c, why: `${danger.phase === 'dwell' ? 'the WAIT' : 'the APPROACH'} `"
        b = "            rejected.push({ ...c, ...(CHASER_STAGED_HUNT.enabled ? { wait: true, ceiling: ceilingFor(c) } : {}), why: `${danger.phase === 'dwell' ? 'the WAIT' : 'the APPROACH'} `"
    assert orig.count(a) == 1, name
    open(F, 'w').write(orig.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerL95Puncher.test.js'], cwd=WT, capture_output=True, text=True)
    out = r.stdout + r.stderr
    import re
    fails = sorted(set(re.findall(r'(?:FAIL|×)\s+.*?hammerL95Puncher\.test\.js > [^>]+> (.+?)(?:\s+\d+ms)?$', out, re.M)))
    summary = [l for l in out.splitlines() if 'Tests' in l and ('passed' in l or 'failed' in l)]
    print(f"{name}: {'RED' if r.returncode else 'GREEN (survived)'} — {summary[-1].strip() if summary else ''}")
    for f in fails: print('   red row:', f[:110])
open(F, 'w').write(orig)
