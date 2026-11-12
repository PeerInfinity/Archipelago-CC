import json,sys,collections
p=json.load(open(sys.argv[1]))
nodes={n['id']:n for n in p['nodes']}
dt=collections.Counter()
for s,d in zip(p['samples'],p['timeDeltas']): dt[s]+=d
self_=collections.Counter(); 
parent={}
for n in p['nodes']:
  for c in n.get('children',[]): parent[c]=n['id']
def name(n): cf=n['callFrame']; return f"{cf['functionName'] or '(anon)'} {cf['url'].split('/')[-1]}:{cf['lineNumber']+1}"
total=collections.Counter()
for nid,d in dt.items():
  self_[name(nodes[nid])]+=d
  seen=set(); x=nid
  while x is not None:
    k=name(nodes[x])
    if k not in seen: total[k]+=d; seen.add(k)
    x=parent.get(x)
T=sum(dt.values())
print('SELF'); [print(f"{v/T*100:5.1f}% {k}") for k,v in self_.most_common(15)]
print('TOTAL'); [print(f"{v/T*100:5.1f}% {k}") for k,v in total.most_common(45)]
