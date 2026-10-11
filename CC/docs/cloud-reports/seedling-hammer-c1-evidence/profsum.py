import json,sys,collections
p=json.load(open(sys.argv[1]))
nodes={n['id']:n for n in p['nodes']}
parent={}
for n in p['nodes']:
    for c in n.get('children',[]): parent[c]=n['id']
dt=p['timeDeltas']; samples=p['samples']
selft=collections.Counter(); incl=collections.Counter()
name=lambda n: f"{n['callFrame']['functionName'] or '(anon)'} {n['callFrame']['url'].split('/')[-1]}:{n['callFrame']['lineNumber']+1}"
total=0
for s,d in zip(samples,dt):
    total+=d
    n=nodes[s]; selft[name(n)]+=d
    seen=set(); cur=s
    while cur is not None:
        nm=name(nodes[cur])
        if nm not in seen: incl[nm]+=d; seen.add(nm)
        cur=parent.get(cur)
print('total s', total/1e6)
print('-- inclusive top (solver functions)')
for k,v in incl.most_common(60):
    if any(x in k for x in ('solverBot','levelRun','dangerMap','spinner','strike','previewStepper','combatVerbs','spaceTime')): print('%7.1f s %5.1f%%  %s'%(v/1e6, 100*v/total, k))
print('-- self top')
for k,v in selft.most_common(15): print('%7.1f s %5.1f%%  %s'%(v/1e6, 100*v/total, k))
