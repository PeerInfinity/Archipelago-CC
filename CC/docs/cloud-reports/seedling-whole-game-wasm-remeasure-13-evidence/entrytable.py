# entrytable.py <capture.jsonl> <entry...>: per entry, the LAST request (the one the walk acted on): outcome, answer, work, ticks and the
# page's per-pass modelHits; R = refusals before it (+retry). The run's every solved answer carries a modelHits stamp (hits.py).
import json,sys
rows={json.loads(l)['id']:json.loads(l) for l in open(sys.argv[1])}
for e in map(int,sys.argv[2:]):
    r=rows.get(e)
    if not r: print(f"| {e} | — | not reached |"); continue
    q=r['requests'][-1]; res=q.get('result') or {}
    ps=[p for p in res.get('passes') or [] if p.get('ok')]
    mh='/'.join(f"{p['pass']}:{(p.get('modelHits') or {}).get('hits')}" for p in ps) or '-'
    ticks='/'.join(str(p.get('ticks')) for p in ps) or '-'
    refs=[f"{x['i']}{'(retry)' if x['retry'] else ''}" for x in r['requests'] if not (x.get('result') or {}).get('ok')]
    print(f"| {e} {r['key']} | {q['i']} {q['goal']}{' (retry)' if q['retry'] else ''} | {'SOLVED' if res.get('ok') else 'REFUSED'} `{res.get('answer')}` | {res.get('work')} | {ticks} | {mh} | {', '.join(refs) or '—'} |")
