#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-cross-pass-cache D2): each mutant applied to a SCRATCH worktree's solverBot.js /
twoPassSolve.js (copied fresh from the source tree first), then the gate file run; prints which rows went red.
usage: xc-mutants.py <source-tree> <scratch-tree> [mutant ...]   (refuses a tree outside the scratchpad)"""
import os, re, shutil, subprocess, sys

src, mut = sys.argv[1], sys.argv[2]
assert '/scratchpad/' in mut, mut
SB = 'frontend/modules/seedlingDemo/solverBot.js'
TP = 'frontend/modules/seedlingDemo/twoPassSolve.js'
TEST = 'frontend/modules/seedlingDemo/escapeCrossPassCache.test.js'

MUTANTS = {
    'M1-no-digest': (SB, "    return { digest, key: `${digest}|${canonicalDigestText(globals)}|${",
                         "    return { digest, key: `|${canonicalDigestText(globals)}|${"),
    'M2-no-pressAt': (SB, "        canonicalDigestText({ state, at, keys, pressAt, id, deadline })}` };",
                          "        canonicalDigestText({ state, at, keys, id, deadline })}` };"),
    'M2b-keys-unordered': (SB, "        canonicalDigestText({ state, at, keys, pressAt, id, deadline })}` };",
                               "        canonicalDigestText({ state, at, keys: keys.map((k) => [...k].sort().join('+')).sort(), "
                               "pressAt, id, deadline })}` };"),
    'M3-no-deadline-state': (SB, "        d === null ? 'none' : `live:${d.fine === true}`,", "        'any',"),
    'M4-hit-skips-asks': (SB, """            case ESCAPE_EV_ASK:
                asks += 1;
                if (deadlineReached('hammer-escape')) {""", """            case ESCAPE_EV_ASK:
                asks += 1;
                if (false) {"""),
    'M5-tripped-miss-stored': (SB, """    if (got.rec.tripped) {
        C.notStoredTripped += 1;
    } else if (run.stateDigest() !== digest) {""", """    if (false) {
        C.notStoredTripped += 1;
    } else if (run.stateDigest() !== digest) {"""),
    'M6-outlives-its-call': (TP, "    const escapeScope = ESCAPE_CROSS_PASS_CACHE.enabled ? escapeCrossPassScope() : null;",
                                 "    const escapeScope = ESCAPE_CROSS_PASS_CACHE.enabled ? (globalThis.__xcMutantScope ??= "
                                 "escapeCrossPassScope()) : null;"),
    'M7-digest-per-tick': (SB, [("""function escapeKeyOf(run, { state, at, keys = [], pressAt, id, deadline = true }) {
    const digest = run.stateDigest();""", """const MUTANT_TICK_DIGEST = new WeakMap();
function tickDigest(run) {
    const m = MUTANT_TICK_DIGEST.get(run);
    if (m && m.t === run.ticksCompleted) return m.d;
    const d = run.stateDigest();
    MUTANT_TICK_DIGEST.set(run, { t: run.ticksCompleted, d });
    return d;
}
function escapeKeyOf(run, { state, at, keys = [], pressAt, id, deadline = true }) {
    const digest = tickDigest(run);"""), ("""    } else if (run.stateDigest() !== digest) {""", """    } else if (tickDigest(run) !== digest) {""")]),
    'M8-no-bypass-after-trip': (SB, "    if (activeDeadline !== null && activeDeadline.tripped.size > 0) {", "    if (false) {"),
}

names = sys.argv[3:] or list(MUTANTS)
for name in names:
    path, *edits = MUTANTS[name]
    if len(edits) == 2:
        edits = [(edits[0], edits[1])]
    else:
        edits = edits[0]
    for f in (SB, TP, TEST):
        shutil.copyfile(os.path.join(src, f), os.path.join(mut, f))
    p = os.path.join(mut, path)
    s = open(p).read()
    for old, new in edits:
        assert s.count(old) == 1, (name, old[:70], s.count(old))
        s = s.replace(old, new)
    open(p, 'w').write(s)
    r = subprocess.run(['npx', 'vitest', 'run', TEST], cwd=mut, capture_output=True, text=True, timeout=1500)
    out = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
    red = sorted(set(re.findall(r'FAIL\s+\S+ > (.+)', out)))
    tally = re.findall(r'Tests\s+(.+)', out)
    print(f'== {name}: rc={r.returncode} {tally[-1] if tally else "?"}')
    for x in red:
        print('   RED', x[:170])
    sys.stdout.flush()
for f in (SB, TP, TEST):
    shutil.copyfile(os.path.join(src, f), os.path.join(mut, f))
print('mutant tree restored to the source')
