import subprocess, sys, shutil
S = sys.argv[1]
base = open(S + '/solverBot.base.js').read()
P = S + '/wt-mut/frontend/modules/seedlingDemo/solverBot.js'
MUT = {
 'M1 no rewind (the first refusal is raised)': ("            row.verdict = 'refused';\n            row.why", "            throw e;\n            row.verdict = 'refused';\n            row.why"),
 'M2 the arm keeps tolerance 0 under the switch': ("...(KILLLOCK_CHASER_REWIND.enabled ? { tolerance: DEFAULT_TOLERANCE, allScored: true } : {}) });", "...(KILLLOCK_CHASER_REWIND.enabled ? { tolerance: 0, allScored: true } : {}) });"),
 'M3 no dying grace': ("        dyingGrace: killWindowTicks(hunted.tag) + HOLD_SLACK,\n    });\n    return { phase", "        dyingGrace: 0,\n    });\n    return { phase"),
 'M4 the queue tried worst-scored first': ("    if (hunt.scored) push(hunted, hunt);", "    if (hunt.scored) push(hunted, { ...hunt, scored: [...hunt.scored].reverse() });"),
 'M5 one attempt per turn (TRIES 1)': ("export const KILLLOCK_CHASER_REWIND_TRIES = 6;", "export const KILLLOCK_CHASER_REWIND_TRIES = 1;"),
 'M6 the asked-bodies filter dropped': ("{ live: live.filter((b) => b.id === hunted.id || !asked.has(b.id)), hunted, hunt });", "{ live, hunted, hunt });"),
 'M7 the deadline rethrow dropped': ("            if (activeDeadline !== null && activeDeadline.tripped.size > 0) {\n                row.verdict = 'deadline';\n                throw e;\n            }", ""),
}
for name, (old, new) in MUT.items():
    assert base.count(old) == 1, name
    open(P, 'w').write(base.replace(old, new))
    r = subprocess.run(['npx', 'vitest', 'run', 'frontend/modules/seedlingDemo/hammerL53Killlock.test.js'], cwd=S + '/wt-mut', capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr
    fails = [l.strip() for l in out.split('\n') if 'FAIL' in l and '>' in l]
    print(f"{name}: {'RED' if r.returncode else 'survived'} {len(fails)} failing row(s) {[f.split('>')[-1][:70] for f in fails]}", flush=True)
open(P, 'w').write(base)
