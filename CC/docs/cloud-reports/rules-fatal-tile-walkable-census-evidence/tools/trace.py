# Per-tick trace of a game run: position, cell of the state SAMPLE POINT (x, y+1) (Player.as:434,679), raw tile there,
# hits / hits_timer, and every enemy within 40 px. usage: python3 trace.py <run.game.json.gz> [every=4] [maxtick]
import gzip, json, sys, math, subprocess
d = json.load(gzip.open(sys.argv[1]))
every = int(sys.argv[2]) if len(sys.argv) > 2 else 4
mx = int(sys.argv[3]) if len(sys.argv) > 3 else 10**9
raw = json.load(open(sys.argv[4])) if len(sys.argv) > 4 else {}
seen = {}
for e in d['reads']:
    seen[e['tick']] = e  # last read of the tick
prev = None
print(json.dumps(d['row'])[:300])
for t in sorted(seen):
    e = seen[t]
    if t > mx: break
    cx, cy = int(e['x'] // 16), int((e['y'] + 1) // 16)
    ev = prev is not None and (e['hits'] != prev['hits'] or (e['hits_timer'] or 0) > (prev['hits_timer'] or 0) or e['level'] != prev['level'] or abs(e['x'] - prev['x']) > 20 or abs(e['y'] - prev['y']) > 20)
    if t % every == 0 or ev:
        near = [f"{x['c']}({x['x']:.0f},{x['y']:.0f}){math.hypot(x['x']-e['x'], x['y']-e['y']):.1f}" for x in e['en'] if math.hypot(x['x']-e['x'], x['y']-e['y']) < 40]
        print(f"t{t:4d} ({e['x']:6.1f},{e['y']:6.1f}) cell {cx},{cy} t={raw.get(f'{cx},{cy}','?')} hits {e['hits']} ht {e['hits_timer']} {'EVENT' if ev else ''} {' '.join(near)}")
    prev = e
