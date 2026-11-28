import json,sys,gzip
f=sys.argv[1]; op=gzip.open if f.endswith('.gz') else open
for l in op(f,'rt'):
    r=json.loads(l)
    for q in r['requests']:
        res=q.get('result') or {}
        b=q['request'].get('budgetWork') if isinstance(q['request'],dict) else None
        print(f"{r['id']}:{q['i']} {r['key']!r} goal={q['goal']!r} retry={q['retry']} budget={b} -> ok={res.get('ok')} kind={res.get('kind')} work={res.get('work')} ans={res.get('answer')} env={res.get('solverEnv')} | {(res.get('message') or '')[:160]}")
