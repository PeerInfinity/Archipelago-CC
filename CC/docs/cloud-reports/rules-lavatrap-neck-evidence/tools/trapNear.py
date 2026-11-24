#!/usr/bin/env python3
"""rules-lavatrap-neck: for each LavaTrap of the boot level, the player's closest approach WHILE that trap is alive (its mob
entry present), the tick it vanished, and the hits/restarts. Usage: trapNear.py <run.game.json.gz> [<level>]"""
import gzip, json, math, re, sys
d = json.load(gzip.open(sys.argv[1])); lv = int(sys.argv[2]) if len(sys.argv) > 2 else None
by = {}
for x in d['reads']:
    if x['tick'] >= 1: by[x['tick']] = x
ticks = sorted(by); lv = lv or by[ticks[0]]['level']
traps = {}
for t in ticks:
    x = by[t]
    if x['level'] != lv: continue
    for m in x['mob']:
        mm = re.match(r'LavaTrap\(([\d.]+),([\d.]+)\)', m)
        if mm: traps.setdefault((float(mm[1]), float(mm[2])), {'near': (1e9, None), 'last': None})
for c, v in traps.items():
    for t in ticks:
        x = by[t]
        if x['level'] != lv: continue
        if not any(m == f'LavaTrap({c[0]:.1f},{c[1]:.1f})' for m in x['mob']): continue
        v['last'] = t
        dd = math.hypot(x['x'] - c[0], x['y'] - c[1])
        if dd < v['near'][0]: v['near'] = (round(dd, 2), t)
end = by[ticks[-1]]
print(json.dumps({'row': {k: d['row'].get(k) for k in ('verdict', 'firstHit', 'hitsInBoot', 'restarts', 'levels')},
    'traps': {f'{c[0]:.0f},{c[1]:.0f}': {'closestWhileAlive': v['near'], 'lastSeenAlive': v['last']} for c, v in traps.items()}}))
