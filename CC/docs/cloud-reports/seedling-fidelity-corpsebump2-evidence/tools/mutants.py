# CORPSEBUMP2 mutants: copy + edit + run + restore (byte-for-byte). Predictions are in PRED.
import subprocess, shutil, hashlib, sys
ROOT='/home/user/Archipelago-CC'
P=ROOT+'/frontend/modules/seedlingDemo/solverBot.js'
FAST='frontend/modules/seedlingDemo/fidelityCorpseBump2.test.js'
SLOW='frontend/modules/seedlingDemo/fidelityCorpseBump2.slow.test.js'
M={
 'M1 drop the re-read': ("        if (restRead) {\n            // a walk press", "        if (false && restRead) {\n            // a walk press", 'no second press'),
 'M2 any walk press counts as a move (the first cut)': ("            const moved = !run.entities('turretsSettled')\n                || Math.abs(now.x - atBody.x) > 0.5 || Math.abs(now.y - atBody.y) > 0.5;", "            const moved = lastPress >= 0;", 'unmoved|no second press'),
 'M3 no stand-out of a young walk press': ("            for (let w = 0; lastPress >= 0 && perTick.length", "            for (let w = 0; false && lastPress >= 0 && perTick.length", 'no second press'),
 'M4 no perTick on runFire\'s refusal': ("if (restRead && e instanceof BotDriverV2Error && e.perTick === undefined) e.perTick", "if (false && restRead && e instanceof BotDriverV2Error && e.perTick === undefined) e.perTick", 'no second press'),
 'M5 refuse the first walk bump': ("                if (walkBumps.length >= c.k) {", "                if (walkBumps.length >= 0) {", 'no second press'),
}
orig=open(P,'rb').read(); h=hashlib.md5(orig).hexdigest()
sel=sys.argv[1:] or list(M)
for name in sel:
    a,b,t=M[name]
    s=orig.decode()
    assert s.count(a)==1, name
    open(P,'w').write(s.replace(a,b,1))
    try:
        rf=subprocess.run(['npx','vitest','run',FAST],cwd=ROOT,capture_output=True,text=True)
        rs=subprocess.run(['npx','vitest','run','-c','vitest.slow.config.js',SLOW,'-t',t],cwd=ROOT,capture_output=True,text=True)
    finally:
        open(P,'wb').write(orig)
    assert hashlib.md5(open(P,'rb').read()).hexdigest()==h
    import re
    clean=lambda x: re.sub(r'\x1b\[[0-9;]*m','',x)
    fl=[l.strip() for l in clean(rf.stdout).splitlines() if l.strip().startswith(('×','✓')) and 'test.js' not in l]
    sl=[l.strip() for l in clean(rs.stdout).splitlines() if l.strip().startswith(('×','✓')) and 'test.js' not in l]
    print(f'== {name}\n  fast: exit {rf.returncode}; red: {[l for l in fl if l.startswith("×")]}\n  slow (-t {t}): exit {rs.returncode}; ' + '; '.join(sl), flush=True)
print('restored', h)
