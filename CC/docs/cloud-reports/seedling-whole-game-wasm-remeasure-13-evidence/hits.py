# hits.py <capture.jsonl>: the page's own per-pass modelHits on every solved answer; prints any with hits>0 and a per-entry tally
import json,sys,collections
tot=collections.Counter(); bad=[]
for l in open(sys.argv[1]):
    r=json.loads(l)
    for q in r['requests']:
        res=q.get('result') or {}
        if not res.get('ok'): continue
        ps=[p for p in (res.get('passes') or []) if p.get('ok')]
        mh=[(p.get('pass'),(p.get('modelHits') or {}).get('hits'),(p.get('modelHits') or {}).get('deaths')) for p in ps]
        tot['solved']+=1
        if any(m[1] is None for m in mh): tot['noModelHits']+=1
        if any((m[1] or 0)>0 or (m[2] or 0)>0 for m in mh): bad.append(f"{r['id']}:{q['i']} {r['key']!r} {q['goal']} ans={res.get('answer')} {mh}")
print(dict(tot)); print('\n'.join(bad) or 'no solved answer with modelHits>0')
