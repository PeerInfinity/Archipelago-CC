# compare.py <off.jsonl> <l40on.jsonl> <followup.jsonl> : per (leg, clock) the three verdicts (OK / HIT n / REF / ERR), plan sha,
# wall s and work, then per leg the counts clean / refused / hit-taking. Same-plan cells print '='.
import json,sys
def load(f):
  d={}
  for l in open(f):
    if l.strip(): o=json.loads(l); d[(o['leg'],o['seam'])]=o
  return d
A,B,C=[load(f) for f in sys.argv[1:4]]
def v(o):
  if o is None or o.get('err'): return 'ERR'
  if not o['ok']:
    m=o.get('message','')
    w='hit-gate' if 'SHOVED_BODY_LOOKAHEAD' in m else ('corner' if 'no step out' in m else ('ladder' if 'EXHAUSTED' in m else ('deadline' if 'deadline' in m else 'other')))
    return 'REF:'+w
  return f"HIT{len(o['hits'])}" if o.get('hits') else 'OK'
print('leg clock | OFF | L40-ON | FOLLOWUP-ON | sha off/l40/fu | wall s off/l40/fu | work off/l40/fu')
tot={}
for k in sorted(A):
  a,b,c=A[k],B.get(k),C.get(k)
  vs=[v(x) for x in (a,b,c)]
  for name,x in zip(('off','l40','fu'),vs):
    t=tot.setdefault((k[0],name),{'clean':0,'refused':0,'hit':0,'err':0})
    t['clean' if x=='OK' else 'hit' if x.startswith('HIT') else 'err' if x=='ERR' else 'refused']+=1
  sh=[(x or {}).get('sha','-') for x in (a,b,c)]
  shs=f"{sh[0]} {'=' if sh[1]==sh[0] else sh[1]} {'=' if sh[2]==sh[1] else sh[2]}"
  print(k[0],k[1],'|',' | '.join(vs),'|',shs,'|','/'.join(str((x or {}).get('ms',0)//1000) for x in (a,b,c)),'|','/'.join(str((x or {}).get('work')) for x in (a,b,c)))
print()
for (leg,name),t in sorted(tot.items()): print(leg,name,t)
