# MEASUREMENT-ONLY: per-step comparison of survey JSONs (verdict, ticks, replay hits/deaths, refusal head).
import json,sys
names=sys.argv[1:]
runs=[(n.split('survey-')[-1].split('.json')[0], {r['step']:r for r in json.load(open(n))['rows']}) for n in names]
def cell(r):
    if r is None: return '—'
    rp=r.get('replay') or {}
    if r['verdict']=='SOLVED': return f"S {r['ticks']}t {rp.get('hits','?')}h {rp.get('deaths','?')}d"
    return 'R '+(r.get('refusal') or '')[:0]+str(hash((r.get('refusal') or '')[:400])%10**6)
steps=sorted(set().union(*[set(m) for _,m in runs]))
diff=0; hitsteps={}
for s in steps:
    cs=[cell(m.get(s)) for _,m in runs]
    for (n,m) in runs:
        r=m.get(s); rp=(r or {}).get('replay') or {}
        if r and r['verdict']=='SOLVED' and (rp.get('hits') or rp.get('deaths')): hitsteps.setdefault(n,[]).append(f"{s} L{r['level']} {rp.get('hits')}h {rp.get('deaths')}d")
    if len(set(cs))>1:
        diff+=1; print(f"step {s} L{runs[0][1][s]['level']}: "+' | '.join(f"{n}: {c}" for (n,_),c in zip(runs,cs)))
print('steps', len(steps), 'differing', diff)
for n,m in runs:
    from collections import Counter
    print(n, dict(Counter(r['verdict'] for r in m.values())), 'steps with hits:', hitsteps.get(n,[]))
