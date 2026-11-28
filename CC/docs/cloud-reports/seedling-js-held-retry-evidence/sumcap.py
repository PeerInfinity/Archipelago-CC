#!/usr/bin/env python3
"""One line per captured solve (the service probe's rows): seq, frame, name, attempt, budget, prefix, live row,
verdict, answer hash, ticks, work, per-pass rows (ok/limit/work/ticks/hits). usage: sumcap.py <arm> <capture.jsonl[.gz]>"""
import gzip, json, sys

arm, path = sys.argv[1], sys.argv[2]
op = gzip.open if path.endswith('.gz') else open
with op(path, 'rt') as f:
    for line in f:
        r = json.loads(line)
        if r.get('probe') != 'svc':
            continue
        for q in r['requests']:
            rq, res = q['request'], q['result']
            row = (rq.get('live') or {}).get('row') or {}
            passes = ' '.join(
                f"{p.get('pass')}:{'ok' if p.get('ok') else (p.get('kind') or 'no')}"
                f"{'/' + p['limit'] if p.get('limit') else ''} w{p.get('work')}"
                f"{' t' + str(p['ticks']) if p.get('ticks') is not None else ''}"
                f"{' h' + str((p.get('modelHits') or {}).get('hits')) if p.get('modelHits') else ''}"
                for p in res.get('passes') or [])
            msg = (res.get('message') or '').split('\n')[0][:110]
            print(f"{arm} #{r['seq']} {r['name']} attempt={json.dumps(r['attempt'], separators=(',', ':'))} "
                  f"budget={rq.get('budgetWork')} passes={[p['pass'] for p in rq['passes']] if rq.get('passes') else 'default'} "
                  f"prefix={len(rq.get('perTick') or [])} boot={json.dumps(rq['staging'].get('boot'), separators=(',', ':'))} "
                  f"row=({row.get('x')},{row.get('y')}) -> {'SOLVED' if res.get('ok') else 'REFUSED'} {res.get('answer')} "
                  f"keys={res.get('keys')} work={res.get('work')} [{passes}]{' msg=' + msg if msg else ''}")
