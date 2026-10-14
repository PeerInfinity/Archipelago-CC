#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sc D2): classify the derivations whose chosen strike differs between the base floor (A)
and the admissible floor (B). usage: sc-diffcats.py <wl.jsonl>..."""
import json, sys
from collections import Counter
for p in sys.argv[1:]:
    rows = [json.loads(l) for l in open(p) if l.strip()]
    c = Counter(); dt = []
    for r in rows:
        a, b = r['A']['res'] or {}, r['B']['res'] or {}
        ka = (a.get('cell'), a.get('pressAt'), a.get('eta')); kb = (b.get('cell'), b.get('pressAt'), b.get('eta'))
        if ka == kb: continue
        if a.get('cell') is None and b.get('cell') is not None: c['A refused, B found'] += 1
        elif a.get('cell') is not None and b.get('cell') is None: c['A found, B refused'] += 1
        elif b['pressAt'] < a['pressAt']: c['B earlier'] += 1; dt.append(a['pressAt'] - b['pressAt'])
        elif b['pressAt'] > a['pressAt']: c['B later'] += 1; dt.append(a['pressAt'] - b['pressAt'])
        else: c['same tick, other cell/eta'] += 1
        if a.get('cell') is not None and b.get('cell') is not None and a.get('uncert') != b.get('uncert'): c['certification differs'] += 1
    dt.sort()
    print(p.rsplit('/', 1)[-1], dict(c), 'pressAt A-B: median', dt[len(dt) // 2] if dt else None, 'min', dt[0] if dt else None, 'max', dt[-1] if dt else None)
