import json,sys
from collections import Counter
def load(p):
    rows=json.load(open(p))['rows']
    return {(r['level'], json.dumps(r['goals'],sort_keys=True), json.dumps(r['boot'],sort_keys=True)): r for r in rows}
a=load(sys.argv[1]); b=load(sys.argv[2])
print('A', Counter(r['verdict'] for r in a.values()), 'B', Counter(r['verdict'] for r in b.values()))
moved=[]
for k in sorted(set(a)|set(b), key=lambda k: (a.get(k) or b.get(k))['step']):
    x=a.get(k); y=b.get(k)
    if not x or not y: moved.append(f"  step {(x or y)['step']} only in {'A' if x else 'B'}"); continue
    if (x['verdict'],x['ticks'])!=(y['verdict'],y['ticks']) or (x.get('refusal') or '')[:200]!=(y.get('refusal') or '')[:200]:
        moved.append(f"  step {x['step']} L{x['level']}: {x['verdict']} {x['ticks']} -> {y['verdict']} {y['ticks']}" + (f"  [{(y.get('refusal') or '')[:140]}]" if y['verdict']!='SOLVED' else ''))
print(len(moved),'moved'); print('\n'.join(moved))
