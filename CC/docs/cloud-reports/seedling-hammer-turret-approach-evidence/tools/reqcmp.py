#!/usr/bin/env python3
# scratch (APPROACH): two request-arm outputs (arms.mjs jsonl) request by request: verdict, ticks, digest (the plan's
# keys or the refusal's text) and the 30(c) check. Usage: reqcmp.py <base.jsonl> <arm.jsonl> -> movers, then a summary.
import json, sys

def load(p):
    return {(r['id'], r['i']): r for r in map(json.loads, open(p))}

a, b = load(sys.argv[1]), load(sys.argv[2])
movers = []
for k in sorted(set(a) | set(b)):
    ra, rb = a.get(k), b.get(k)
    if not ra or not rb or ra['digest'] != rb['digest'] or ra['ok'] != rb['ok']:
        movers.append((k, ra, rb))
sa = sum(r['ok'] for r in a.values())
sb = sum(r['ok'] for r in b.values())
gma = sum(1 for r in a.values() if r['ok'] and (r.get('gm') or {}).get('gm') and not (r['gm'].get('hits')))
gmb = sum(1 for r in b.values() if r['ok'] and (r.get('gm') or {}).get('gm') and not (r['gm'].get('hits')))
print(f'# base {sa}/{len(a)} solved ({gma} hitless+modelled), arm {sb}/{len(b)} solved ({gmb} hitless+modelled), {len(movers)} mover(s)')
for (i, n), ra, rb in movers:
    def d(r):
        if not r:
            return 'absent'
        if r['ok']:
            return f"SOLVED {r['ticks']} gm={(r.get('gm') or {}).get('gm')} hits={(r.get('gm') or {}).get('hits')}"
        return f"{r['kind']} {(r['head'] or '')[-260:]}"
    print(f'## {i}/{n} {(ra or rb)["key"]}')
    print(f'   base: {d(ra)}')
    print(f'   arm:  {d(rb)}')
    if rb and rb.get('ta'):
        print(f'   approaches: {json.dumps(rb["ta"])[:300]}')
