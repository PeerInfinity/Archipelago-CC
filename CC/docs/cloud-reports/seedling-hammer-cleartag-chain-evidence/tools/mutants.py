# MEASUREMENT ONLY (CLEARTAG-CHAIN): apply each mutant to solverBot.js in a separate worktree (argv[1]), run the default-tier
# rows (hammerClearTagChain.test.js), restore. Copied in shape from CLEARTAG-STAND's tools/mutants.py.
import subprocess, sys, pathlib
# argv[2] (optional): 'train' runs the train-tier rows instead (hammerClearTagChain.train.test.js); argv[3:]: mutant prefixes
wt = pathlib.Path(sys.argv[1]); tier = sys.argv[2] if len(sys.argv) > 2 else 'default'; only = sys.argv[3:]
TEST = (['--config', 'vitest.train.config.js', 'frontend/modules/seedlingDemo/hammerClearTagChain.train.test.js'] if tier == 'train'
        else ['frontend/modules/seedlingDemo/hammerClearTagChain.test.js'])
f = wt / 'frontend/modules/seedlingDemo/solverBot.js'; orig = f.read_text()
M = {
  'M1 the switch ignored (the chain OFF too)': (
    '        while (CLEARTAG_CHAIN.enabled && resolved.prerequisite) {',
    '        while (resolved.prerequisite) {'),
  'M2 no re-derivation (the stale resolution kept)': (
    '            if (written()) break;\n            ({ resolved, contacts } = resolveCT());',
    '            break;'),
  'M3 no stance walk (the burn run from where the player stands)': (
    '        if (order.resolved.stance) {\n            const walking = `${label}#${perTick.length}`;',
    '        if (false) {\n            const walking = `${label}#${perTick.length}`;'),
  'M4 the exemptions not carried': (
    '        for (const c of order.resolved.exempt ?? []) exemptions.add(c);\n        return order;',
    '        return order;'),
  'M5 the order not counted in the strategy bound': (
    '        applied.push(label);\n        seeRow({',
    '        seeRow({'),
  'M6 the repeat guard dropped': (
    '            if (chained.includes(p.id)) {',
    '            if (false) {'),
}
try:
  for name, (a, b) in M.items():
    if only and not any(name.startswith(o + ' ') for o in only): continue
    assert orig.count(a) == 1, name
    f.write_text(orig.replace(a, b))
    r = subprocess.run(['npx', 'vitest', 'run', *TEST], cwd=wt, capture_output=True, text=True)
    fails = [l.strip() for l in r.stdout.splitlines() if '×' in l]
    print(f"[{tier}] {name}: {'RED' if r.returncode else 'GREEN (SURVIVED)'}  {' | '.join(fails)[:400]}", flush=True)
finally:
  f.write_text(orig)
