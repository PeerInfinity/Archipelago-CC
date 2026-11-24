#!/usr/bin/env python3
"""rules-lavatrap-neck: one line per tick of a play.mjs game run (last read per tick): level, position, hits, dead_frames,
live LavaTraps, runners. Usage: gameTrace.py <run.game.json.gz> [--every=N] [--from=T] [--to=T] [--traps=cx,cy;...]"""
import gzip, json, sys, math
a = dict(x.split('=', 1) for x in sys.argv[2:] if '=' in x)
every = int(a.get('--every', 10)); t0 = int(a.get('--from', 1)); t1 = int(a.get('--to', 10**9))
traps = [tuple(map(float, p.split(','))) for p in a.get('--traps', '').split(';') if p]
d = json.load(gzip.open(sys.argv[1]))
by = {}
for x in d['reads']:
    if x['tick'] >= 1: by[x['tick']] = x
prev = None
for t in sorted(by):
    x = by[t]
    if not (t0 <= t <= t1): prev = x; continue
    ev = prev is not None and (x['hits'] != prev['hits'] or x['dead_frames'] != prev['dead_frames'] or x['level'] != prev['level']
                               or sum('LavaTrap' in m for m in x['mob']) != sum('LavaTrap' in m for m in prev['mob']))
    if t % every == 0 or ev:
        live = [m for m in x['mob'] if 'LavaTrap' in m]
        dist = ' '.join(f'{math.hypot(x["x"] - cx, x["y"] - cy):.1f}' for cx, cy in traps)
        print(t, 'L%d' % x['level'], round(x['x'], 2), round(x['y'], 2), 'hits', x['hits'], 'df', x['dead_frames'],
              'traps', ','.join(m.replace('LavaTrap', '') for m in live), ('dist ' + dist) if traps else '',
              'run', ' '.join(m.replace('LavaRunner', '') for m in x['mob'] if 'Runner' in m), '<<' if ev else '')
    prev = x
