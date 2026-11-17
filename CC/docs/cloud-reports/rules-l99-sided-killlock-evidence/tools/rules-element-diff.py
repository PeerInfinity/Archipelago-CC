import json,sys
def regs(p):
    d=json.load(open(p)); r=d['regions']; return r.get('1',r)
a=regs(sys.argv[1]); b=regs(sys.argv[2])
ch=[]
for n in sorted(set(a)|set(b)):
    ea={e['name']:json.dumps(e.get('access_rule'),sort_keys=True)+'|'+e['connected_region'] for e in a.get(n,{}).get('exits',[])}
    eb={e['name']:json.dumps(e.get('access_rule'),sort_keys=True)+'|'+e['connected_region'] for e in b.get(n,{}).get('exits',[])}
    la={l['name']:json.dumps(l.get('access_rule'),sort_keys=True) for l in a.get(n,{}).get('locations',[])}
    lb={l['name']:json.dumps(l.get('access_rule'),sort_keys=True) for l in b.get(n,{}).get('locations',[])}
    for k in sorted(set(ea)|set(eb)):
        if ea.get(k)!=eb.get(k): ch.append(('exit',n,k))
    for k in sorted(set(la)|set(lb)):
        if la.get(k)!=lb.get(k): ch.append(('loc',n,k))
lv=sorted({c[1].split('__')[0] for c in ch})
print(len(ch),'changed elements in levels',lv)
for c in ch[:12]: print(' ',c)
