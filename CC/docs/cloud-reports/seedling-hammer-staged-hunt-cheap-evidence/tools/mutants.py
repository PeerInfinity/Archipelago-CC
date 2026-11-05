# scratch (STAGED-HUNT-CHEAP): each mutant applied to the working tree, the fast rows run by path, the file restored
# byte for byte (asserted). Usage: python3 mutants.py  (from the repo root)
import subprocess, sys
M = 'frontend/modules/seedlingDemo/stagedHuntScanMemo.js'
B = 'frontend/modules/seedlingDemo/solverBot.js'
MUTANTS = [
    ('key ignores the world', M, 'memo.key === key && memo.world === world', 'memo.key === key'),
    ('key ignores the player state', M, 'canonicalDigestText({ state, planOpts, allowTeleporter, aim })', 'canonicalDigestText({ planOpts, allowTeleporter, aim })'),
    ('key ignores the plan options', M, 'canonicalDigestText({ state, planOpts, allowTeleporter, aim })', 'canonicalDigestText({ state, allowTeleporter, aim })'),
    ('a function is keyed', M, 'if (BARE_FN.test(key)) {', 'if (false) {'),
    ('the memo is made OFF too', M, 'return STAGED_HUNT_SCAN_MEMO.enabled ? { key: null, world: null, entry: null } : null;', 'return { key: null, world: null, entry: null };'),
    ('no cell is stored', B, '                        cellMemo.set(ck, open);\n', ''),
    ('a reused cell still spends a unit', B, "                if (open === undefined) {\n                    if (fineDeadlineReached('kill-chaser')) { scanTripped = true; return; }", "                if (fineDeadlineReached('kill-chaser')) { scanTripped = true; return; }\n                if (open === undefined) {"),
    ('a reused cell is open', B, '                if (!open) continue;\n                candidates.push', '                if (!open && !cellMemo?.has(ck)) continue;\n                candidates.push'),
    ('the hunt passes no memo', B, 'dashMode, scanMemo }', 'dashMode, scanMemo: null }'),
]
TEST = 'frontend/modules/seedlingDemo/hammerStagedHuntScanMemo.test.js'
for name, path, a, b in MUTANTS:
    orig = open(path).read()
    assert orig.count(a) == 1, name
    open(path, 'w').write(orig.replace(a, b))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', TEST], capture_output=True, text=True)
        out = r.stdout + r.stderr
        reds = [l.strip() for l in out.split('\n') if '×' in l]
        print(f"{name}: {'RED' if r.returncode else 'GREEN (survived)'} — {len(reds)} row(s): " + ' | '.join(x[:110] for x in reds))
    finally:
        open(path, 'w').write(orig)
        assert open(path).read() == orig
