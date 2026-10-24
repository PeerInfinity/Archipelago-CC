# mutants2.py — RK2's mutants (RK's mutants.py, its harness): apply each to the worktree, run the RK and RK2 rows of
# solveProgress.test.js, record which rows red, restore the file byte-for-byte. Run from the worktree root.
import subprocess, re, sys, pathlib, json
SP = pathlib.Path('frontend/modules/seedlingDemo/solveProgress.js')
MUTANTS = {
  # r1: a precondition rule on the FIELD alone — every `unresolved` is a state gate
  'r1': [(SP, "    'prerequisite': 'precondition', 'cannot-act': 'precondition' });",
              "    'prerequisite': 'precondition', 'cannot-act': 'precondition', 'unresolved': 'precondition' });")],
  # r2: `name` taken from the MESSAGE instead of the error object
  'r2': [(SP, "key: same ? seg.lastWhy.key : key, name: progressErrorName(x) };",
              "key: same ? seg.lastWhy.key : key, name: /^[\\w$]+/.exec(progressWhy(x) ?? '')?.[0] ?? null };")],
  # r3: a family rule keyed on a RUNG name
  'r3': [(SP, "        if (o.bound === 'deadline') return 'deadline';\n",
              "        if (o.bound === 'deadline') return 'deadline';\n        if (o.rung === 'dodge') return 'diverged';\n")],
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
                        '--reporter=json', '--outputFile=/tmp/claude-0/rk2-mutant.json'], capture_output=True, text=True)
        d = json.load(open('/tmp/claude-0/rk2-mutant.json'))
        res = [a for r in d['testResults'] for a in r['assertionResults']]
        red = [a for a in res if a['status'] == 'failed']
        print(f"== {name}: {len(red)} red, {sum(a['status'] == 'passed' for a in res)} green", flush=True)
        for a in red:
            print('   RED', a['title'][:150])
            for m in a.get('failureMessages', [])[:1]: print('      ', re.sub(r'\x1b\[[0-9;]*m', '', m.splitlines()[0])[:200])
    finally:
        for f, s in saved.items(): f.write_text(s)
