# mutants.py — apply each RK mutant to the worktree, run the RK rows of solveProgress.test.js, record which rows red,
# restore the file byte-for-byte. Run from the worktree root.
import subprocess, re, sys, pathlib, json
SP = pathlib.Path('frontend/modules/seedlingDemo/solveProgress.js')
SB = pathlib.Path('frontend/modules/seedlingDemo/solverBot.js')
ROW = "        const rowFor = (rung, refused, extra = {}) => {\n            if (activeProgress !== null) progressRow(rung, refused, extra);\n"
MUTANTS = {
  'k1': [(SP, "    const kind = err === null ? null : progressKind(err);\n",
              "    const kind = err === null ? null : progressKind(progressReason(err));\n")],
  'k2': [(SP, "    seg.lastWhy = { why: progressWhy(x), kind, key: same ? seg.lastWhy.key : key };\n",
              "    seg.lastWhy = [...(Array.isArray(seg.lastWhy) ? seg.lastWhy : []), { why: progressWhy(x), kind, key }];\n")],
  'k3': [(SB, ROW, "        const rowFor = (rung, refused, extra = {}) => {\n            if (activeProgress !== null) { activeDeadline?.shouldStop('walk'); progressRow(rung, refused, extra); }\n")],
  'k4': [(SB, ROW, "        const rowFor = (rung, refused, extra = {}) => {\n            const rkKind = progressKind(refused);\n            if (activeProgress !== null) progressRow(rung, refused, extra);\n"),
         (SB, "import { activeProgress, progressAsked,", "import { progressKind, activeProgress, progressAsked,")],
}
only = sys.argv[1:] or list(MUTANTS)
for name in only:
    saved = {}
    try:
        for f, a, b in MUTANTS[name]:
            s = saved.setdefault(f, f.read_text()) if f not in saved else f.read_text()
            assert s.count(a) == 1, (name, a)
            f.write_text(s.replace(a, b))
        subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/solveProgress.test.js', '-t', 'RK',
                        '--reporter=json', '--outputFile=/tmp/rk-mutant.json'], capture_output=True, text=True)
        d = json.load(open('/tmp/rk-mutant.json'))
        res = [a for r in d['testResults'] for a in r['assertionResults']]
        red = [a for a in res if a['status'] == 'failed']
        print(f"== {name}: {len(red)} red, {sum(a['status'] == 'passed' for a in res)} green")
        for a in red:
            print('   RED', a['title'][:150])
            for m in a.get('failureMessages', [])[:1]: print('      ', re.sub(r'\x1b\[[0-9;]*m', '', m.splitlines()[0])[:200])
    finally:
        for f, s in saved.items(): f.write_text(s)
