import json,sys
def load(p):
  out={}
  for l in open(p):
    r=json.loads(l)
    if 'key' not in r: continue
    out[r['key']]=r
  return out
runs={n:load(p) for n,p in (a.split('=') for a in sys.argv[1:])}
names=list(runs)
keys=sorted(set().union(*[set(r) for r in runs.values()]))
def sig(r):
  if r is None: return 'MISSING'
  return f"{r.get('end')}|hits={(r.get('roomHits') or {}).get('max')}|{str(r.get('failed') or '')[:160]}"
same=0
for k in keys:
  s=[sig(runs[n].get(k)) for n in names]
  if len(set(s))==1: same+=1; continue
  r0=next(runs[n][k] for n in names if k in runs[n])
  print(r0['id'], k)
  for n,x in zip(names,s): print('   ',n,x)
from collections import Counter
for n in names: print(n, len(runs[n]), Counter(r.get('end') for r in runs[n].values()))
print('equal in all:', same, 'of', len(keys))
