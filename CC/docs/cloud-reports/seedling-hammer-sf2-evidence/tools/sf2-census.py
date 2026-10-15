#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sf2 D1): summarise the SF2 lab's per-derivation records (SF_LAB=census).
Every derivation ran each variant in `make-lab2.py`'s list (b only at continuation derivations). Composite (d)
shapes are built here: d-<x> = b at a continuation (admission) derivation, <x> elsewhere.
usage: sf2-census.py <wl.jsonl>...  → one JSON object per workload."""
import json, sys
from collections import Counter

def key(r):
    r = r or {}
    return (tuple(r['cell']) if r.get('cell') else None, r.get('pressAt'), r.get('eta'))

def cat(off, x):
    """x against OFF: same · earlier · lost (OFF found, x refused) · found (OFF refused, x found) · later · other."""
    if 'threw' in (x or {}) or 'threw' in (off or {}): return 'threw'
    ko, kx = key(off), key(x)
    if ko == kx: return 'same'
    if ko[0] is not None and kx[0] is None: return 'lost'
    if ko[0] is None and kx[0] is not None: return 'found'
    if kx[1] < ko[1]: return 'earlier'
    if kx[1] > ko[1]: return 'later'
    return 'other'

def view(r, v):
    """(res, ms, previews) of variant v in record r; d-<x> composes b at a continuation with x elsewhere."""
    if v.startswith('d-'):
        v = 'b' if r['cont'] else v[2:]
    x = r['V'][v]
    return x['res'], x['ms'], x['previews']

def variants(rows):
    base = [v for v in rows[0]['V'] if v != 'b']
    out = list(base)
    if any('b' in r['V'] for r in rows):
        out += ['d-a', 'd-floor'] + [f'd-{v}' for v in base if v.startswith('co')]
    return out

for p in sys.argv[1:]:
    rows = [json.loads(l) for l in open(p) if l.strip()]
    wl = p.rsplit('/', 1)[-1].replace('.jsonl', '')
    s = dict(wl=wl, derivations=len(rows), cont=sum(r['cont'] for r in rows))
    if not rows:
        print(json.dumps(s)); continue
    V = variants(rows)
    s['variants'] = V
    for v in V:
        s[f'ms_{v}'] = round(sum(view(r, v)[1] for r in rows) / 1000, 2)
        s[f'previews_{v}'] = sum(view(r, v)[2] for r in rows)
        s[f'refused_{v}'] = sum(1 for r in rows if (view(r, v)[0] or {}).get('cell') is None)
        if v == 'off':
            continue
        c = Counter(cat(view(r, 'off')[0], view(r, v)[0]) for r in rows)
        s[f'cat_{v}'] = dict(c)
        # the strikes shape a finds that this variant loses (a found one, the variant refuses)
        s[f'aLost_{v}'] = sum(1 for r in rows if (view(r, 'a')[0] or {}).get('cell') is not None
                              and (view(r, v)[0] or {}).get('cell') is None)
        # against a: same / a earlier / v earlier
        s[f'vsA_{v}'] = dict(Counter(cat(view(r, 'a')[0], view(r, v)[0]) for r in rows))
    print(json.dumps(s))
