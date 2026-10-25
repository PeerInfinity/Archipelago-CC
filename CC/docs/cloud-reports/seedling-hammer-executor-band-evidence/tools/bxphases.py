#!/usr/bin/env python3
"""SCRATCH (BX): census rows -> per-seam class (the ANSWER's own pass), phases solving of 45 over 5226..5270, the overlap
check, the class tally, and the bx counters. Usage: bxphases.py <rows.jsonl> [--seams]"""
import json, sys
from collections import Counter
def cls_msg(p):
    if p['ok']: return 'SOLVE'
    m = p.get('message') or ''
    if m.startswith('chaserForecast: whether'): return 'band-throw'
    if m.startswith('levelRun: whether'): return 'band-throw(live)'
    for tag in ('SCRATCH-A', 'SCRATCH-B', 'SCRATCH-C', 'EXECUTOR_SHAKE_BAND'):
        if tag in m: return tag + ('@gate' if ' gate' in m.split(tag)[1][:200] else '@probe' if 'probe' in m.split(tag)[1][:200] else '') 
    if 'nowhere to be' in m: return 'HAMMER_SAFETY(nowhere)' + ('+band' if 'PRESS_KILL_SHAKE_GUARD' in m else '')
    if 'There is no step out' in m or 'every key set' in m: return 'HAMMER_SAFETY(step)'
    if 'anytime deadline' in m: return 'deadline'
    if 'the player died at t' in m: return 'reboot'
    if 'EXHAUSTED' in m: return 'EXHAUSTED'
    if 'ran the strike schedule' in m: return 'strike-bound'
    return 'other:' + m[:70]
def klass(r):
    if r['ok']: return 'SOLVE'
    ps = [p for p in r['passes'] if p['answer'] == r['answer']] or r['passes'][-1:]
    return cls_msg(ps[0])
rows = {}
for l in open(sys.argv[1]):
    r = json.loads(l); rows[r['seam']] = r
period = [s for s in range(5226, 5271) if s in rows]
assert len(period) == 45, f'missing {sorted(set(range(5226,5271))-set(rows))}'
solves = [s for s in period if rows[s]['ok']]
print(f'phases solving: {len(solves)} of 45')
pairs = [(s, s + 45) for s in period if s + 45 in rows]
same = [p for p in pairs if (rows[p[0]]['answer'], rows[p[0]]['work']) == (rows[p[1]]['answer'], rows[p[1]]['work'])]
print(f'overlap pairs {len(pairs)}, identical answer+units {len(same)}')
for k, v in Counter(klass(rows[s]) for s in period).most_common(): print(f'- {v}x {k}')
bx = Counter()
for s in period:
    for k, v in (rows[s].get('bx') or {}).items(): bx[k] += v if k != 'maxRun' else 0
print('bx (period sums):', dict(bx), 'maxRun', max([(rows[s].get('bx') or {}).get('maxRun', 0) for s in period] or [0]))
print('shakeRefused (period sum):', sum(rows[s]['guards']['shakeRefused'] for s in period))
if '--seams' in sys.argv:
    for s in sorted(rows): print(s, klass(rows[s]), rows[s]['work'], rows[s]['answer'], rows[s].get('bx'))
