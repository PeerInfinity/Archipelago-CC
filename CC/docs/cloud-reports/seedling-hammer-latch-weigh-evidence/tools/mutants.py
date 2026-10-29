# scratch (LWEIGH): each mutant applied to solverBot.js, the rows run, the file restored byte for byte.
import subprocess, sys, shutil
ROOT = '/home/user/Archipelago-CC'
P = ROOT + '/frontend/modules/seedlingDemo/solverBot.js'
FAST = 'frontend/modules/seedlingDemo/hammerLatchWeigh.test.js'
SLOW = 'frontend/modules/seedlingDemo/hammerLatchWeigh.slow.test.js'
M = {
    'M1 drop the reorder': [("            return latchWeighFirst(run, obstacle, opener, onto, hold, contacts, blocked) ?? hold;",
                             "            return hold;")],
    'M2 the range test inverted': [("            && Math.trunc(Math.hypot(stance.x - t.x, stance.y - t.y)) <= ICE_TURRET.attackRange)",
                                    "            && Math.trunc(Math.hypot(stance.x - t.x, stance.y - t.y)) > ICE_TURRET.attackRange)")],
    'M3 offer the weigh where no corpse route exists': [("    const c = derived.corpse ?? null;",
        "    const c = derived.corpse ?? (inRange.length ? { turret: inRange[0], alive: true, from: { tx: 0, ty: 0 }, dir: { dx: 0, dy: -1 }, k: 1, presses: [] } : null);")],
}
orig = open(P).read()
shutil.copy(P, '/tmp/claude-0/-home-user-Archipelago-CC/95ed9647-56da-5a0a-9d68-65f8c5d86e45/scratchpad/s/solverBot.pre-mutant.js')
try:
    for name, reps in M.items():
        s = orig
        for a, b in reps:
            assert s.count(a) == 1, (name, a)
            s = s.replace(a, b)
        open(P, 'w').write(s)
        runs = [['npx', 'vitest', 'run', FAST]]
        if name.startswith(('M1', 'M2')):
            runs.append(['npx', 'vitest', 'run', '--config', 'vitest.slow.config.js', SLOW, '-t', 'OFF plans the hold stance'])
        for cmd in runs:
            r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, timeout=3000)
            out = r.stdout + r.stderr
            fails = [l.strip() for l in out.split('\n') if ('×' in l or 'FAIL' in l) and 'hammerLatchWeigh' not in l[:3]]
            summ = [l.strip() for l in out.split('\n') if 'Tests ' in l]
            print(f'{name} :: {cmd[-1] if cmd[-2] != "-t" else "slow row 1"} :: exit {r.returncode} :: {summ}', flush=True)
            for l in out.split('\n'):
                if '×' in l: print('    RED', l.strip()[:200], flush=True)
finally:
    open(P, 'w').write(orig)
print('restored', open(P).read() == orig)
