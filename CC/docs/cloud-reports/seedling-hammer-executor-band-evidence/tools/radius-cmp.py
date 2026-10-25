#!/usr/bin/env python3
"""SCRATCH (BX): the L40 radius — two arms' RESULT rows by (id, i): identical / movers with class and units.
Usage: radius-cmp.py <a.jsonl> <b.jsonl>"""
import json, sys
exec(open(__file__.replace('radius-cmp.py', 'bxphases.py')).read().split('rows = {}')[0])
def load(p): return {(r['id'], r['i']): r for r in map(json.loads, open(p))}
a, b = load(sys.argv[1]), load(sys.argv[2])
keys = sorted(set(a) & set(b))
movers = [k for k in keys if (a[k]['ok'], a[k]['work'], a[k]['answer']) != (b[k]['ok'], b[k]['work'], b[k]['answer'])]
print(f'{len(keys)} requests (missing a {len(set(b)-set(a))}, b {len(set(a)-set(b))}); identical {len(keys)-len(movers)}; movers {len(movers)}')
print(f'solves: a {sum(a[k]["ok"] for k in keys)}  b {sum(b[k]["ok"] for k in keys)}')
for k in movers:
    print(f'- ({k[0]}, i{k[1]}) seam {a[k]["seam"]} {a[k]["key"]}: {klass(a[k])[:40]} {a[k]["work"]}u{"/"+str(a[k]["ticks"])+"t" if a[k]["ok"] else ""} -> {klass(b[k])[:40]} {b[k]["work"]}u{"/"+str(b[k]["ticks"])+"t" if b[k]["ok"] else ""}  bx={b[k].get("bx")}')
band = [k for k in keys if klass(a[k]).startswith('band')]
print('band-throw answers in a:', [(k, a[k]['seam']) for k in band])
pm = [(k, p['pass']) for k in keys for p, q in zip(a[k]['passes'], b[k]['passes']) if (p['ok'], p['answer']) != (q['ok'], q['answer'])]
print('pass-level answer movers:', [(k, ps, a[k]['key'][:60]) for k, ps in pm])
pb = [(k, p['pass']) for k in keys for p in a[k]['passes'] if not p['ok'] and (p.get('message') or '').startswith('chaserForecast: whether')]
print('band-throw passes in a:', pb)
