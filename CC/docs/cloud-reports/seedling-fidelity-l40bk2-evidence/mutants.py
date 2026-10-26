import subprocess, shutil, json, sys, os
W='/home/user/wt-mut'
F=W+'/frontend/modules/seedlingDemo/solverBot.js'
orig=open(F,encoding='utf-8').read()
M=[
 ('m1','chainWeighHypothesis admits nothing',
  "    let pending = chained;\n    /** The turrets whose corpse", "    let pending = chained;\n    if (true) return extra;\n    /** The turrets whose corpse", 'D1'),
 ('m2','stanceReaches ignores the entry exemption',
  "        ...hypothesis.flatMap((h) => h.exempt ?? [])]);", "        ]);", 'D1'),
 ('m3','nextPastUnbound returns null',
  "    const nextPastUnbound = (failed, failedStrategy, rest, contacts, aim, allowTeleporter) => {\n", "    const nextPastUnbound = (failed, failedStrategy, rest, contacts, aim, allowTeleporter) => {\n        if (true) return null;\n", 'D1'),
 ('m4','spinRow attaches no rows',
  "        sample.spinners = { rects: spinCursor.rows[i], ids: now.map((b) => b.id), bodyGated };", "        void bodyGated;", 'D2'),
 ('m5','bodyGated always false',
  "            return p.destroy || (p.hitsTimer > 0 ? p.hitsTimer - 1 : p.hitsTimer) > 0;", "            return false && p;", 'D2'),
 ('m6','no whole-chain certificate',
  "        const c = planSwordDash(run, wps, { ...opts, certify: blind });\n        if (!c.plan) return c;", "        const c = planSwordDash(run, wps, { ...opts, certify: blind });\n        if (true) return planSwordDash(run, wps, { ...opts, certify: (samples) => probeSamples(samples, except) });\n        if (!c.plan) return c;", 'D2'),
  ('m7','no chained fallback in deriveHoldStance',
  "    if (chainedAdm.length) {\n        const wider", "    if (false) {\n        const wider", 'D1'),
]
only = sys.argv[1:] 
for mid, what, old, new, d in M:
    if only and mid not in only: continue
    assert orig.count(old)==1, (mid, orig.count(old))
    open(F,'w',encoding='utf-8').write(orig.replace(old,new))
    pat = 'L40BK2 D1 — a weigh' if d=='D1' else 'L40BK2 D2'
    r=subprocess.run(['npx','vitest','run','frontend/modules/seedlingDemo/fidelityL40Bk2.test.js','-t',pat,'--reporter=json','--outputFile=/tmp/claude-0/mut-%s.json'%mid],cwd=W,capture_output=True,text=True,timeout=1800)
    open(F,'w',encoding='utf-8').write(orig)
    d2=json.load(open('/tmp/claude-0/mut-%s.json'%mid))
    reds=[a['title'] for f in d2['testResults'] for a in f['assertionResults'] if a['status']=='failed']
    greens=[a['title'] for f in d2['testResults'] for a in f['assertionResults'] if a['status']=='passed']
    print(f"{mid} ({what}): RED {reds} | green {len(greens)}", flush=True)
assert open(F,encoding='utf-8').read()==orig
print('restored, cmp clean')
