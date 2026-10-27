import subprocess, sys, re, shutil
WT = sys.argv[1]
F = WT + '/frontend/modules/seedlingDemo/solverBot.js'
M = [
 ('M1 the drive asks no policy', "            if (opp !== null && !run.state.fall && (oppPending", "            if (false && opp !== null && !run.state.fall && (oppPending"),
 ('M2 the strike preview walks with no policy', "                            opp !== null ? { strikeFor: oppStrikeFor('strikePreviews') } : undefined);", "                            undefined);"),
 ('M3 the refuge preview walks with no policy', "                        opp !== null ? { strikeFor: oppStrikeFor('refugePreviews') } : undefined);", "                        undefined);"),
 ('M4 the kill never defers its aim', "                if (opp === null || opp.lastPressAt === null) return false;", "                return false;"),
 ('M5 the offer withholds nothing', "        if (policy.aimed !== null) return bodies;", "        return bodies;"),
 ('M6 the kill aims over an owed press', "            } else if (!oppPending\n", "            } else if (true\n"),
]
orig = open(F).read()
ONLY = sys.argv[2:]
M = [m for m in M if not ONLY or m[0].split()[0] in ONLY]
for name, a, b in M:
    assert orig.count(a) == 1, name
    open(F, 'w').write(orig.replace(a, b))
    try:
        r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerOpportunisticStrike.test.js'], cwd=WT, capture_output=True, text=True, timeout=1200)
        out = re.sub(r'\x1b\[[0-9;]*m', '', r.stdout + r.stderr)
        tests = [l.strip() for l in out.splitlines() if 'Tests ' in l]
        err = [l.strip() for l in out.splitlines() if l.strip().startswith(('AssertionError', 'SolverRefusal', 'Error', 'SolverBotError'))][:1]
        print(f"{name}: {'RED' if r.returncode else 'GREEN (mutant survived)'} | {tests[-1] if tests else ''} | {err[0][:200] if err else ''}", flush=True)
    finally:
        open(F, 'w').write(orig)
