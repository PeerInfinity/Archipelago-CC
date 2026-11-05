import json,sys
from collections import Counter
def load(p):
    d=json.load(open(p)); return {(r['step']):r for r in d['rows']}
A=load(sys.argv[1]); B=load(sys.argv[2])
for n,X in (('A',A),('B',B)):
    c=Counter(r['verdict'] for r in X.values()); print(n, sys.argv[1 if n=='A' else 2].split('/')[-1], dict(c))
    fz=[(s,r['level'],(r.get('refusal') or '')[:140]) for s,r in X.items() if 'FROZEN' in json.dumps(r) or 'frozen-press' in json.dumps(r)]
    print('  frozen-press rows:', fz)
mv=0
for s in sorted(set(A)|set(B)):
    a=A.get(s); b=B.get(s)
    ka=(a['verdict'], a.get('ticks'), (a.get('refusal') or '')[:80]) if a else None
    kb=(b['verdict'], b.get('ticks'), (b.get('refusal') or '')[:80]) if b else None
    if ka!=kb:
        mv+=1; print('  MOVE step',s,'L',(a or b)['level'],ka,'->',kb)
print('movers',mv)
