# MEASUREMENT-ONLY: the keyed page legs, arm by arm (end, answer, room hits, plans), and the legs that differ.
import json,sys
arms=[(a.split('legs-')[-1].split('.jsonl')[0], {json.loads(l)['key']:json.loads(l) for l in open(a) if l.strip()}) for a in sys.argv[1:]]
def cell(r):
    if r is None: return '—'
    rh=r.get('roomHits') or {}; h=len(rh.get('hits') or []) if isinstance(rh,dict) else rh
    pl=r.get('plans') or []
    a=r.get('answer'); a=(a.get('ok'), a.get('action')) if isinstance(a,dict) else a
    import hashlib
    dig=hashlib.sha1(json.dumps([(p.get('ok'),p.get('kind'),p.get('ticks'),p.get('verbs')) for p in pl]).encode()).hexdigest()[:8]
    return f"{r.get('end')} answer={a} roomHits={h} plans={len(pl)} refused={sum(1 for p in pl if not p.get('ok'))} ticks={[p.get('ticks') for p in pl]} digest={dig}"
keys=sorted(set().union(*[set(m) for _,m in arms]))
same=0
for k in keys:
    cs=[cell(m.get(k)) for _,m in arms]
    if len(set(cs))==1: same+=1; flag=' '
    else: flag='*'
    print(flag, k); [print('     ',n,c) for (n,_),c in zip(arms,cs)]
print('legs', len(keys), 'identical', same)
from collections import Counter
for n,m in arms: print(n, dict(Counter(r.get('end') for r in m.values())), 'legs with roomHits:', sum(1 for r in m.values() if isinstance(r.get('roomHits'),dict) and r['roomHits'].get('hits')))
