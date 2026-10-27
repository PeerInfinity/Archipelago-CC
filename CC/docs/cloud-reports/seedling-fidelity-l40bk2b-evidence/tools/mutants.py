# copy + edit + run + restore; each mutant on solverBot.js, the L40BK2B rows (fidelityL40Bk2b.test.js) run against it
import subprocess, shutil, sys
R='/home/user/Archipelago-CC/'; F=R+'frontend/modules/seedlingDemo/solverBot.js'; BK='/tmp/claude-0/mut/solverBot.js.orig'
M={
 'M1': ("                if (clear(p)) return p;\n", "                if (true) return { x: c.x + rad * Math.cos(ang), y: c.y + rad * Math.sin(ang) };\n"),
 'M2': ("        const n = Math.max(1, Math.ceil(Math.hypot(p.x - s.x, p.y - s.y) / ORBIT_FREE_AIM.sweep));\n        for (let i = 1; i <= n; i += 1) {", "        const n = Math.max(1, Math.ceil(Math.hypot(p.x - s.x, p.y - s.y) / ORBIT_FREE_AIM.sweep));\n        for (let i = n; i <= n; i += 1) {"),
 'M3': ("    const wps = planWaypointsOrNull(run.world, s, { x: c.x, y: c.y }, null, {});\n", "    const wps = null;\n"),
 'M4': ("    return new Set(applied).size >= MAX_STRATEGIES_PER_GOAL || applied.length >= STRATEGY_BOUND_TOTAL;\n", "    return applied.length >= MAX_STRATEGIES_PER_GOAL;\n"),
 'M5': ("    return new Set(applied).size >= MAX_STRATEGIES_PER_GOAL || applied.length >= STRATEGY_BOUND_TOTAL;\n", "    return new Set(applied).size >= MAX_STRATEGIES_PER_GOAL;\n"),
}
shutil.copy(F, BK)
try:
    for name,(a,b) in M.items():
        s=open(BK).read(); assert s.count(a)==1, name
        open(F,'w').write(s.replace(a,b))
        out=subprocess.run(['npx','vitest','run','frontend/modules/seedlingDemo/fidelityL40Bk2b.test.js'],cwd=R,capture_output=True,text=True).stdout
        reds=[l.strip() for l in out.splitlines() if '×' in l or 'FAIL' in l and '>' in l]
        summ=[l.strip() for l in out.splitlines() if 'Tests ' in l]
        print(name, summ, *reds, sep='\n   ')
        sys.stdout.flush()
finally:
    shutil.copy(BK, F)
print('restored', subprocess.run(['git','diff','--stat','--',F],cwd=R,capture_output=True,text=True).stdout or 'clean')
