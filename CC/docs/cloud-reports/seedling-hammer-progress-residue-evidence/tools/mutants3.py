# mutants3.py — PR's mutants (RK2's mutants2.py harness): apply each, run the PR rows (and, for p2, RK's and RK2's
# rows too) of solveProgress.test.js, record which rows red, restore every file byte-for-byte. Run from the repo root.
import subprocess, re, sys, pathlib, json
SP = pathlib.Path('frontend/modules/seedlingDemo/solveProgress.js')
DRV = pathlib.Path('frontend/modules/seedlingDemo/botDriverV2.js')
OUT = '/tmp/claude-0/-home-user-Archipelago-CC/071a5a51-c293-520e-8e83-ae1c1938397c/scratchpad/pr-mutant.json'
MUTANTS = {
  # p1: the soft-lock words removed from the rule (a pattern that never matches)
  'p1': ([(SP, "const SOFT_LOCK_WORDS = /\\bis a (?:soft-lock|SOFT-LOCK)\\b/;", "const SOFT_LOCK_WORDS = /(?!)/;")], 'soft-lock|family'),
  # p2: `soft-lock` placed AFTER `other`
  'p2': ([(SP, "'diverged', 'error', 'soft-lock', 'other']);", "'diverged', 'error', 'other', 'soft-lock']);")], 'order|RK'),
  # p3: the rule reads the bare noun
  'p3': ([(SP, "const SOFT_LOCK_WORDS = /\\bis a (?:soft-lock|SOFT-LOCK)\\b/;", "const SOFT_LOCK_WORDS = /soft-lock/i;")], 'soft-lock|stretched'),
  # p4: the memo's count point unguarded (and made null-safe so the solve still runs)
  'p4': ([(DRV, "        if (activeProgress !== null) progressStringPull(v !== undefined); // ⛓ PR: emit-only, the memo's hit or miss",
               "        progressStringPull(v !== undefined); // ⛓ PR: emit-only, the memo's hit or miss"),
          (SP, "    cacheEntries += 1;\n    const seg = activeProgress.seg;\n    if (seg === null) return;\n    const c = seg.caches.stringPull",
               "    cacheEntries += 1;\n    const seg = activeProgress?.seg ?? null;\n    if (seg === null) return;\n    const c = seg.caches.stringPull")],
         'unhooked|guarded'),
  # p5: the escape member reports the process-wide counters, not the segment's delta
  'p5': ([(SP, ".map(([out, k]) => [out, (e[k] ?? 0) - c.escapeBase[k]])),", ".map(([out, k]) => [out, e[k] ?? 0])),")], 'cross-pass escape cache ON'),
  # p6: churn kept as a list of the frames opened
  'p6': ([(SP, "    seg.stack.push(frame);\n    seg.churn.opened += 1;", "    seg.stack.push(frame);\n    seg.churn.opened = [...(Array.isArray(seg.churn.opened) ? seg.churn.opened : []), node.key];")], 'bounded'),
}
only = sys.argv[1:] or list(MUTANTS)
for name in only:
    edits, pattern = MUTANTS[name]
    saved = {}
    try:
        for f, a, b in edits:
            if f not in saved: saved[f] = f.read_text()
            s = f.read_text()
            assert s.count(a) == 1, (name, a)
            f.write_text(s.replace(a, b))
        subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/solveProgress.test.js', '-t', pattern,
                        '--reporter=json', f'--outputFile={OUT}'], capture_output=True, text=True)
        d = json.load(open(OUT))
        res = [a for r in d['testResults'] for a in r['assertionResults'] if a['status'] in ('passed', 'failed')]
        red = [a for a in res if a['status'] == 'failed']
        print(f"== {name}: {len(red)} red, {sum(a['status'] == 'passed' for a in res)} green  (-t '{pattern}')", flush=True)
        for a in red:
            print('   RED', a['title'][:150])
            for m in a.get('failureMessages', [])[:1]: print('      ', re.sub(r'\x1b\[[0-9;]*m', '', m.splitlines()[0])[:200])
    finally:
        for f, s in saved.items(): f.write_text(s)
