#!/usr/bin/env python3
# scratch (L40C): two route-survey outputs (--through=end --out) row by row: verdict, ticks and the refusal text
# (ms ignored). Usage: survcmp.py <base.json> <arm.json>  -> one line per step, `same` or `MOVED`, then the movers.
import json, sys

a, b = (json.load(open(p))['rows'] for p in sys.argv[1:3])
ia = {r['step']: r for r in a}
ib = {r['step']: r for r in b}
sig = lambda r: (r['verdict'], r.get('ticks'), r.get('refusal'), json.dumps(r.get('replay'), sort_keys=True))
movers = []
for s in sorted(set(ia) | set(ib), key=lambda x: int(x)):
    ra, rb = ia.get(s), ib.get(s)
    same = ra and rb and sig(ra) == sig(rb)
    print(f"{s}\tL{(ra or rb)['level']}\t{ra and ra['verdict']}\t{rb and rb['verdict']}\t{ra and ra.get('ticks')}\t{rb and rb.get('ticks')}\t{'same' if same else 'MOVED'}")
    if not same:
        movers.append((s, ra, rb))
print(f'# {len(movers)} mover(s); base {sum(r["verdict"] == "SOLVED" for r in a)} SOLVED / {len(a)}, '
      f'arm {sum(r["verdict"] == "SOLVED" for r in b)} SOLVED / {len(b)}')
for s, ra, rb in movers:
    print(f'## step {s} L{ra["level"]}: {ra["verdict"]} {ra.get("ticks")} -> {rb["verdict"]} {rb.get("ticks")}')
    print(f'   base: {(ra["refusal"] or "")[-400:]}')
    print(f'   arm:  {(rb["refusal"] or "")[-400:]}')
