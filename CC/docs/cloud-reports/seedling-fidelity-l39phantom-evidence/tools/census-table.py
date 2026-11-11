import json,sys,re
# per arm: lands by seam, dashless ok, refusal causes (phantom = spinner@112,88 named)
for f in sys.argv[1:]:
    rows=[json.loads(l) for l in open(f) if l.strip()]
    ok=sum(1 for r in rows if r['ok'])
    dl=sum(1 for r in rows if r['passes'][0]['ok'])
    ph=sum(1 for r in rows if not r['ok'] and 'spinner@112,88' in (r.get('message') or ''))
    budget=sum(1 for r in rows if not r['ok'] and 'deadline' in (r.get('message') or '') and 'shouldStop' in (r.get('message') or ''))
    other=[r['seamTime'] for r in rows if not r['ok'] and 'spinner@112,88' not in (r.get('message') or '') and 'shouldStop' not in (r.get('message') or '')]
    print(f"{f.split('/')[-1]}: n={len(rows)} lands={ok}/{len(rows)} dashlessPlans={dl} phantomRefusal={ph} budget={budget} other={sorted(other)} failSeams={sorted(r['seamTime'] for r in rows if not r['ok'])}")
