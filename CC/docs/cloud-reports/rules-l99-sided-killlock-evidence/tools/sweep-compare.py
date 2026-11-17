"""Item-aware sweep of two rules.json files; compares region/location sweep indices. Usage: sweep2.py before.json after.json"""
import json, sys
from collections import Counter
def load(p):
    d=json.load(open(p)); regs=d['regions']; regs=regs.get('1',regs)
    st=d.get('start_regions',{}).get('1',{}).get('default',['Menu']); return regs,st
def ok(r, inv):
    k=r['rule']; a=r.get('args',{})
    if k=='True_': return True
    if k=='False_': return False
    if k=='Has': return inv[a['item_name']]>=a.get('count',1)
    if k=='HasAny': return any(inv[i]>=1 for i in a['item_names'])
    if k=='HasAll': return all(inv[i]>=1 for i in a['item_names'])
    if k=='HasAnyCount': return any(inv[i]>=n for i,n in a['item_counts'].items())
    if k=='HasAllCounts': return all(inv[i]>=n for i,n in a['item_counts'].items())
    if k=='And': return all(ok(c,inv) for c in r['children'])
    if k=='Or': return any(ok(c,inv) for c in r['children'])
    raise ValueError(k)
def sweep(regs,START):
    inv=Counter(); got=set(); rsph={}; lsph={}; s=0
    def reach():
        seen=set(START); q=list(START)
        while q:
            r=q.pop()
            for e in regs[r].get('exits',[]):
                t=e['connected_region']
                if t not in seen and ok(e['access_rule'],inv): seen.add(t); q.append(t)
        return seen
    def avail(seen,ev):
        return [(l['name'],l['item']['name']) for r in seen for l in regs[r].get('locations',[]) if l['name'] not in got and bool(l.get('event'))==ev and ok(l['access_rule'],inv)]
    while True:
        while True:
            seen=reach(); evs=avail(seen,True)
            if not evs: break
            for n,it in evs: got.add(n); lsph[n]=s; inv[it]+=1
        for r in seen: rsph.setdefault(r,s)
        new=avail(seen,False)
        if not new: return rsph,lsph
        for n,it in new: got.add(n); lsph[n]=s; inv[it]+=1
        s+=1
a=sweep(*load(sys.argv[1])); b=sweep(*load(sys.argv[2]))
GOAL='Level 115 - The Seed'
rm={r:[a[0].get(r),b[0].get(r)] for r in sorted(set(a[0])|set(b[0])) if a[0].get(r)!=b[0].get(r)}
lm={n:[a[1].get(n),b[1].get(n)] for n in sorted(set(a[1])|set(b[1])) if a[1].get(n)!=b[1].get(n)}
print(json.dumps({'regions_before':len(a[0]),'regions_after':len(b[0]),'locations_before':len(a[1]),'locations_after':len(b[1]),
 'goal_sweep':[a[1].get(GOAL),b[1].get(GOAL)],'regions_moved':len(rm),'locations_moved':len(lm),
 'moved_regions':dict(list(rm.items())[:30]),'moved_locations':dict(list(lm.items())[:30])},indent=1))
