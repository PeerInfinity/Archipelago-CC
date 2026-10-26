import subprocess, sys, shutil
P='frontend/modules/seedlingDemo/solverBot.js'
M={
 'm1': ("    return { stand: { ticks: resolved.hold.ticks, keys: () => () => NO_KEYS, hold: true } };", "    return {};"),
 'm3': ("    if (c.destroy || !strike || s.fall) return held;", "    if (true) return held;"),
 'm4': ("if (CONTACT_FIDELITY.chaserOrbitKill && !swordless && hunted.id.startsWith('bobsoldier@')) {", "if (false) {"),
 'm5': ("    else if (Math.abs(off) < safe) aim = at(r, (off >= 0 ? 1 : -1) * ORBIT_KILL.step);", "    else if (false) aim = null;"),
 'm2': ("        } else if (stand?.hold === true) {", "        } else if (false) {"),
}
name, cmd = sys.argv[1], sys.argv[2]
old, new = M[name]
src = open(P).read()
assert src.count(old) == 1, name
shutil.copy(P, '/tmp/claude-0/-home-user-Archipelago-CC/f50fd5a8-4112-525c-8ddf-660c3b0749fd/scratchpad/solverBot.pre-mutant.js')
open(P, 'w').write(src.replace(old, new))
try:
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    out = r.stdout + r.stderr
    import re
    lines = [l for l in out.split('\n') if re.search(r'(✓|×|Tests |REFUSED|SOLVED|ms \d)', l)]
    print(f'== {name} rc={r.returncode}'); print('\n'.join(lines[-30:]))
finally:
    open(P, 'w').write(src)
