import subprocess,sys
P='frontend/modules/seedlingDemo/solverBot.js'
M={
 'M1-drop-pair':("            if (removable.length === 0) removable = choosePairToRemove(aim, contacts, allowTeleporter, hit);\n","            // MUTANT: no pair\n"),
 'M2-drop-scope':("            if (removable.length === 0) removable = choosePairToRemove(aim, contacts, allowTeleporter, hit);\n","            { const pr = choosePairToRemove(aim, contacts, allowTeleporter, hit); removable = [...pr, ...removable.filter((b) => !pr.some((p) => p.id === b.id))]; }\n"),
 'M3-nonadmitting':("            if (!admitsWithout(set)) continue;\n","            admitsWithout(set);\n"),
}
for name,(a,b) in M.items():
    s=open(P).read(); assert s.count(a)==1,name
    open(P,'w').write(s.replace(a,b))
    r=subprocess.run(['npx','vitest','run','frontend/modules/seedlingDemo/hammerChooserPair.test.js'],capture_output=True,text=True)
    subprocess.run(['git','checkout','--',P])
    out=r.stdout+r.stderr
    lines=[l for l in out.split('\n') if ('✓' in l or '×' in l or 'Tests' in l)]
    print('==',name,'exit',r.returncode); print('\n'.join(lines)); sys.stdout.flush()
