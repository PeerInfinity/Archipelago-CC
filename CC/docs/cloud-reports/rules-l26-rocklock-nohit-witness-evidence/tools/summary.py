# Per page run: the tick each puncher started its death anim, the tick the run entered L28, max player hits over every
# sampled tick, and the closest player-puncher centre distance while that puncher was alive (not dying).
import json, sys, math, glob, gzip
for f in sys.argv[1:]:
    d = json.load(gzip.open(f) if f.endswith('.gz') else open(f)); S = {s[0]: s for s in d['samples']}
    die = {}; mind = {}
    # puncher identity by spawn: the first sample row order is stable (A = the one that starts at (88,176))
    first = {}
    by_t = {}
    for r in d['mobs']:
        if r[1] == 'Puncher': by_t.setdefault(r[0], []).append(r)
    track = {'A': (88, 176), 'B': (40, 216)}
    for t in sorted(by_t):
        rows = by_t[t]
        for name, (px, py) in sorted(track.items(), key=lambda kv: min((math.hypot(q[2]-kv[1][0], q[3]-kv[1][1]) for q in rows), default=0)):
            if not rows: break
            r = min(rows, key=lambda q: math.hypot(q[2] - px, q[3] - py)); rows.remove(r); track[name] = (r[2], r[3])
            if r[7]: del track[name]; continue          # destroyed: this body leaves the roster
            if r[4] == 'die' and name not in die: die[name] = (t, r[2], r[3])
            s = S.get(t)
            if s and s[1] == 26 and r[4] != 'die' and not r[7]:
                dist = math.hypot(s[2] - r[2], s[3] - r[3])
                if dist < mind.get(name, (1e9,))[0]: mind[name] = (round(dist, 1), t)
            if r[4] == 'die' and s and name in die and die[name][0] == t:
                die[name] = (t, r[2], r[3], round(math.hypot(s[2] - r[2], s[3] - r[3]), 1))
    l28 = next((s[0] for s in d['samples'] if s[1] == 28), None)
    print(json.dumps({'run': f.split('/')[-1], 'items': d['row']['items'], 'ticks': d['row']['ticks'], 'die(t,x,y,dist)': die,
                      'closest_alive(dist,t)': mind, 'L28_at': l28, 'max_hits': max(s[4] for s in d['samples']), 'clears': d['row']['clears']}))
