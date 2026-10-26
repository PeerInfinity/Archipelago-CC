import subprocess, shutil, sys
P='/home/user/Archipelago-CC/frontend/modules/seedlingDemo/solverBot.js'
KEEP='/tmp/claude-0/-home-user-Archipelago-CC/4b925bac-f075-5c78-aefd-deb3ced2cec7/scratchpad/i/solverBot.keep.js'
M = {
 'M1 no treatment (ON block removed)': ("if (PRESS_KILL_CHASERS.enabled && !held.has('primary') && run.chaserForecast?.()) {", "if (false) {"),
 'M2 landing test always clear': ("    const f = run.chaserForecast?.() ?? null;\n    if (f === null) return true;\n    const next = previewOrDeath", "    const f = null;\n    if (f === null) return true;\n    const next = previewOrDeath"),
 'M3 one forecast step (the wrong pairing)': ("        f.step(run.state);\n        rows = f.step(next);", "        rows = f.step(next);"),
}
for name,(a,b) in M.items():
    s=open(KEEP).read(); assert s.count(a)==1, name
    open(P,'w').write(s.replace(a,b,1))
    r=subprocess.run(['npx','vitest','run','frontend/modules/seedlingDemo/hammerPressKillChasers.test.js'],cwd='/home/user/Archipelago-CC',capture_output=True,text=True)
    out=r.stdout+r.stderr
    import re
    out=re.sub(r'\x1b\[[0-9;]*m','',out)
    line=[l for l in out.splitlines() if 'Tests ' in l]
    err=[l.strip() for l in out.splitlines() if 'AssertionError' in l or 'Error:' in l][:1]
    print(name, '|', line[-1].strip() if line else '?', '|', err)
    shutil.copy(KEEP,P)
