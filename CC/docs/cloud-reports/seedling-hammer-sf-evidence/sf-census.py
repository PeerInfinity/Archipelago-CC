#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sf D2): summarise the lab's per-derivation records (SF_LAB=census): every derivation ran
OFF, `floor` (the admissible floor alone), `a` (floor + measured ETA, 40 kept pairs) and `b` (floor + measured ETA,
40 distinct cells previewed). usage: sf-census.py <wl.jsonl>...  → one JSON object per workload."""
import json, sys
from collections import Counter

def key(r):
    r = r or {}
    return (tuple(r['cell']) if r.get('cell') else None, r.get('pressAt'), r.get('eta'))

def cat(off, x):
    """x against OFF: same · earlier · lost (OFF found, x refused) · found (OFF refused, x found) · later · other."""
    ko, kx = key(off), key(x)
    if 'threw' in (x or {}) or 'threw' in (off or {}): return 'threw'
    if ko == kx: return 'same'
    if ko[0] is not None and kx[0] is None: return 'lost'
    if ko[0] is None and kx[0] is not None: return 'found'
    if kx[1] < ko[1]: return 'earlier'
    if kx[1] > ko[1]: return 'later'
    return 'other'

for p in sys.argv[1:]:
    rows = [json.loads(l) for l in open(p) if l.strip()]
    wl = p.rsplit('/', 1)[-1].replace('.jsonl', '')
    s = dict(wl=wl, derivations=len(rows), cont=sum(r['cont'] for r in rows))
    if not rows:
        print(json.dumps(s)); continue
    V = ['off', 'floor', 'a', 'b']
    for v in V:
        s[f'ms_{v}'] = round(sum(r['V'][v]['ms'] for r in rows) / 1000, 1)
        s[f'previews_{v}'] = sum(r['V'][v]['previews'] for r in rows)
        s[f'refused_{v}'] = sum(1 for r in rows if (r['V'][v]['res'] or {}).get('cell') is None)
    for v in V[1:]:
        c = Counter(cat(r['V']['off']['res'], r['V'][v]['res']) for r in rows)
        s[f'cat_{v}'] = dict(c)
        d = [r['V']['off']['res']['pressAt'] - r['V'][v]['res']['pressAt'] for r in rows
             if cat(r['V']['off']['res'], r['V'][v]['res']) == 'earlier']
        d.sort()
        s[f'earlierBy_{v}'] = {'median': d[len(d) // 2], 'max': d[-1]} if d else None
    # the floor-only variant's lost strikes: does a / b recover them?
    lostF = [r for r in rows if cat(r['V']['off']['res'], r['V']['floor']['res']) == 'lost']
    for v in ('a', 'b'):
        s[f'floorLost_{v}'] = dict(Counter(cat(r['V']['off']['res'], r['V'][v]['res']) for r in lostF))
    w = [r['w'] for r in rows]
    s['arrived'] = sum(x['arrived'] for x in w)
    s['underOff'] = sum(x['underOff'] for x in w)
    s['maxOffMinusEta'] = max([x['maxOffMinusEta'] for x in w if x['maxOffMinusEta'] is not None] or [None])
    s['underOn'] = sum(x['underOn'] for x in w)
    s['minEtaMinusOn'] = min([x['minEtaMinusOn'] for x in w if x['minEtaMinusOn'] is not None] or [None])
    s['worstOn'] = next((x['worst'] for x in w if x['worst']), None)
    s['ice'] = sum(r['ice'] for r in rows)
    s['v0over1.6'] = sum(1 for r in rows if max(abs(r['v0'][0]), abs(r['v0'][1])) > 1.6)
    print(json.dumps(s))
