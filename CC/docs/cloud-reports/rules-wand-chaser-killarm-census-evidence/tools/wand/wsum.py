#!/usr/bin/env python3
"""rules-wand-chaser-killarm-census: summarise wplay.mjs game runs.
Per run: the verdict (0 hits / first hit tick, restarts), the boot level's enemies by spawn identity (nearest-track from
their tick-1 position), each enemy's landed-hit ticks (hits rising), its kill tick (anim 'die' or gone), the wand
shots spawned (new WandShot rows) and landed (sum of enemy hit increments), and who was nearest at the first hit.
  python3 wsum.py <run.game.json.gz> ...   [--trace=<from>-<to>]"""
import gzip, json, math, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
TR = next((a.split('=')[1] for a in sys.argv if a.startswith('--trace=')), None)
for f in args:
    d = json.load(gzip.open(f)); row = d['row']; reads = d['reads']
    if 'error' in row: print(f, 'ERROR', row['error']); continue
    boot = reads[0]['level'] if reads else None
    rb = [r for r in reads if r['level'] == boot and r.get('en') is not None]
    # de-dup ticks (keep the last read per tick)
    byt = {}
    for r in rb: byt[r['tick']] = r
    ticks = sorted(byt)
    tracks = []  # each: {cls, pos, hits:[(t,h)], kill:None, last}
    for t in ticks:
        en = byt[t]['en']; used = set()
        for e in en:
            best = None
            for i, tr in enumerate(tracks):
                if i in used or tr['cls'] != e['c'] or tr['gone']: continue
                dd = math.hypot(tr['x'] - e['x'], tr['y'] - e['y'])
                if dd < 8 and (best is None or dd < best[0]): best = (dd, i)
            if best is None:
                tracks.append({'cls': e['c'], 'spawn': (e['x'], e['y']), 'first': t, 'x': e['x'], 'y': e['y'], 'h': e['h'], 'hits': [], 'kill': None, 'gone': False, 'seen': t, 'minD': 1e9, 'minDt': None})
                best = (0, len(tracks) - 1)
            tr = tracks[best[1]]; used.add(best[1])
            if e['h'] > tr['h']: tr['hits'].append((t, e['h']))
            tr.update(x=e['x'], y=e['y'], h=e['h'], seen=t)
            if (e['a'] == 'die' or e['d']) and tr['kill'] is None: tr['kill'] = t
            dp = math.hypot(e['x'] - byt[t]['x'], e['y'] - byt[t]['y'])
            if dp < tr['minD']: tr['minD'], tr['minDt'] = dp, t
        for i, tr in enumerate(tracks):
            if i not in used and not tr['gone'] and tr['seen'] < t:
                tr['gone'] = True
                if tr['kill'] is None: tr['kill'] = t
    shots = 0; prev = []
    for t in ticks:
        cur = [s for s in (byt[t].get('shots') or []) if s['c'] == 'WandShot' and s.get('a') == 'flare']
        for s_ in cur:
            if not any(abs(s_['x'] - p['x']) + abs(s_['y'] - p['y']) <= 3.6 for p in prev): shots += 1
        prev = cur
    fh = row.get('firstHit')
    near = None
    if fh is not None and fh in byt:
        p = byt[fh]
        near = min(((math.hypot(e['x'] - p['x'], e['y'] - p['y']), e['c'], e['x'], e['y']) for e in p['en'] if e['c'] not in ('WandShot',)), default=None)
    landed = sum(len(tr['hits']) for tr in tracks)
    print(f"{row['tape']}: verdict={row['verdict']} firstHit={fh} hitsInBoot={row['hitsInBoot']} restarts={row['restarts']} levels={row['levels']} end={row['end']}")
    print(f"   shots spawned={shots} landed={landed}" + (f" nearest@firstHit={near[1]}({near[2]},{near[3]}) {near[0]:.1f}px" if near else ''))
    for tr in tracks:
        if tr['cls'] in ('LavaRunner', 'Puncher', 'Drill', 'Bulb', 'Bob', 'Grenade') or tr['hits']:
            print(f"   {tr['cls']}@spawn{tr['spawn']}: hits {[(t, h) for t, h in tr['hits']]} kill={tr['kill']} closest={tr['minD']:.1f}px@t{tr['minDt']}")
    if TR:
        a, b = map(int, TR.split('-'))
        for t in ticks:
            if a <= t <= b:
                r = byt[t]
                print(f"   t{t} P({r['x']:.1f},{r['y']:.1f}) hits={r['hits']} " + ' '.join(f"{e['c'][:4]}({e['x']:.0f},{e['y']:.0f})h{e['h']}/{e['ht']}{'D' if e['a']=='die' else ''}" for e in r['en'] if e['c'] in ('LavaRunner','Bulb','Puncher','Drill')))
