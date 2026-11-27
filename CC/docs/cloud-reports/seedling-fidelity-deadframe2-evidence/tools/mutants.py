import subprocess,sys,re,json
W='/tmp/claude-0/wt-mut'; F=W+'/frontend/modules/seedlingDemo/levelRun.js'
M={
 'M1 the Pulser queue is never flushed': [("    const flushDeadPulserFramesNow = (activators, which) => {\n        if (pendingDeadPulserFrames.length === 0) return;","    const flushDeadPulserFramesNow = (activators, which) => {\n        if (pendingDeadPulserFrames.length >= 0) return;")],
 'M2 a texted lump runs the Pulser 149 frames': [("queueDeadPulserFramesNow(CEREMONY_DEAD_FRAMES.pickup, `${hit.tag ?? 'pickup'}'s phase A`);","queueDeadPulserFramesNow(ceremony.dialogue === null ? CEREMONY_DEAD_FRAMES.pickup : CEREMONY_LUMP_SHOVE_FRAMES, `${hit.tag ?? 'pickup'}'s phase A`);")],
 'M3 a site before the live step waits for the next advance (no after-flush)': [("            if (pendingDeadPulserFrames.length > 0) flushDeadPulserFramesNow(activators, 'after');\n","")],
 'M4 the block arm is never asked': [("            if (CONTACT_FIDELITY.blockPressesFallRockButtonSameFrame && !noclip) armButtonFallRocksByBlocksNow();\n","")],
 'M5 the seal piece queues nothing': [("        queueFreezeResponderFramesNow(CEREMONY_DEAD_FRAMES.total, `sealpiece ${sealPieceFrom}`);\n","")],
 'M6 a frozen tick steps the Pulsers once': [("        // ⛓ SLOTS: `Game.update`'s tail runs on a frozen frame too.\n        flushPendingRemoved();","        if (CONTACT_FIDELITY.pulserDeadFrameUpdate && !noclip) { if (pendingDeadPulserFrames.length > 0) flushDeadPulserFramesNow(activators, 'before'); stepPulsersFrozenNow(activators, 1, what); }\n        // ⛓ SLOTS: `Game.update`'s tail runs on a frozen frame too.\n        flushPendingRemoved();")],
}
out={}
for name,eds in M.items():
    s=open(F).read(); o=s
    for a,b in eds:
        n=s.count(a); assert n==1,(name,n,a[:60]); s=s.replace(a,b)
    open(F,'w').write(s)
    r=subprocess.run(['npx','vitest','run','frontend/modules/seedlingDemo/fidelityDeadFrame2.test.js','--maxWorkers=3'],cwd=W,capture_output=True,text=True)
    txt=re.sub(r'\x1b\[[0-9;]*m','',r.stdout+r.stderr)
    fails=sorted(set(l.split(' > ',1)[1].strip() for l in txt.splitlines() if l.strip().startswith('FAIL ') and ' > ' in l))
    out[name]=fails; print(name, len(fails)); [print('   ',f[:170]) for f in fails]
    open(F,'w').write(o)
r=subprocess.run(['git','-C',W,'diff','--quiet']); print('restored clean' if r.returncode==0 else 'NOT CLEAN')
json.dump(out,open('/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-fidelity-deadframe2-evidence/d3/mutants.json','w'),indent=1)
