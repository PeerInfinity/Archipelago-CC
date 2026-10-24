# LB D2 — the gate's mutants: each is one exact edit of solverBot.js, the named gate rows run, the file restored and
# its md5 checked. Measure only. Run from a SCRATCH worktree carrying this slice's files (never the live tree while
# other processes load it): cd <scratch> && python3 <this> > d2/mutants.txt
import hashlib, subprocess, sys
F = 'frontend/modules/seedlingDemo/solverBot.js'
GATE = 'frontend/modules/seedlingDemo/hammerPressKillGuards.test.js'
MUTANTS = [
    ('M1 the shake catch ignores its switch', 'HO1',
     "if (!PRESS_KILL_SHAKE_GUARD.enabled || !isShakeBandThrow(e)) throw e;",
     "if (!isShakeBandThrow(e)) throw e;"),
    ('M2 the band\'s walk is not marked truncated', 'HO1',
     "const out = { walk: { truncated: { kind: 'shake-band' }, samples: [] }, eta: 0, unsafe: null,",
     "const out = { walk: { truncated: null, samples: [] }, eta: 0, unsafe: null,"),
    ('M3 the reboot guard ignores its switch', 'HO2 OFF',
     "if (PRESS_KILL_REBOOT_GUARD.enabled && (run.ledger('playerDeaths') ?? []).length > diedBefore) {",
     "if ((run.ledger('playerDeaths') ?? []).length > diedBefore) {"),
    ('M4 the reboot guard refuses on any tick (>= for >)', 'HO2 ON',
     "if (PRESS_KILL_REBOOT_GUARD.enabled && (run.ledger('playerDeaths') ?? []).length > diedBefore) {",
     "if (PRESS_KILL_REBOOT_GUARD.enabled && (run.ledger('playerDeaths') ?? []).length >= diedBefore) {"),
]
md5 = lambda: hashlib.md5(open(F, 'rb').read()).hexdigest()
orig = open(F, encoding='utf8').read()
base = md5()
print('base md5', base)
only = sys.argv[1:]
for name, rows, old, new in MUTANTS:
    if only and name.split()[0] not in only:
        continue
    assert orig.count(old) == 1, name
    open(F, 'w', encoding='utf8').write(orig.replace(old, new))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', GATE, '-t', rows], capture_output=True, text=True, timeout=3000)
        tail = [l for l in r.stdout.splitlines() if ('✓' in l or '×' in l or 'Tests' in l)]
        print(f'{name}: exit {r.returncode}')
        for l in tail:
            print('   ', l.strip())
    finally:
        open(F, 'w', encoding='utf8').write(orig)
        assert md5() == base, 'restore failed'
print('restored md5', md5())
