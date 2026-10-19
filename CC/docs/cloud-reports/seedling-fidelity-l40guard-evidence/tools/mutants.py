import subprocess, hashlib, sys, os
os.chdir(sys.argv[1]); D='frontend/modules/seedlingDemo/'
M=[('M1','solverBot.js',"const kind = others.length > 0 ? 'leash' : 'timing';","const kind = others.length > 0 ? 'timing' : 'leash';"),
   ('M2','solverBot.js',"if (scored.length === 0 && CONTACT_FIDELITY.guardApproachStance) {","if (scored.length === 0) {"),
   ('M3','solverBot.js',"const id = o?.kind === 'danger' ? o.blocker?.id : undefined;","const id = o?.kind === 'dangerX' ? o.blocker?.id : undefined;"),
   ('M4','levelRun.js',"if (c.v.x !== 0 || c.v.y !== 0 || c.hitsTimer > 0) return false;","if (c.hitsTimer > 0) return false;"),
   ('M5','levelRun.js',"if (!CONTACT_FIDELITY.shakeBandMoot || camBand === null) return false;","if (camBand === null) return false;"),
   ('M6','levelRun.js',"if (!CONTACT_FIDELITY.spinnerSwingLineOfSight) return null;\n","")]
for name,f,a,b in M:
    p=D+f; orig=open(p,encoding='utf-8').read(); md=hashlib.md5(orig.encode()).hexdigest()
    assert orig.count(a)==1,(name,a)
    open(p,'w',encoding='utf-8').write(orig.replace(a,b))
    r=subprocess.run(['npx','vitest','run',D+'fidelityL40Guard.test.js','--reporter=verbose'],capture_output=True,text=True)
    open(p,'w',encoding='utf-8').write(orig)
    assert hashlib.md5(open(p,encoding='utf-8').read().encode()).hexdigest()==md
    red=[l.strip() for l in r.stdout.splitlines() if '×' in l or '✗' in l or 'FAIL' in l and '>' in l]
    print(name, 'rc', r.returncode, '| red:', red[:4])
