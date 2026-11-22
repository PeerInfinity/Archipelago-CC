# Verdict of one game run against a tile GOAL: the first tick the state sample point (x, y+1) (Player.as:434,679) stands
# in the goal cell, every tick hits_timer ARMS (a hit of any kind: enemy damage or the lava hit(null,0), Player.as:1468),
# every restart, every cell of the sample point (in order), and the closest any enemy came. usage:
#   python3 verdict.py <run.game.json.gz> <gx,gy> <raw.json>
import gzip, json, sys, math
d = json.load(gzip.open(sys.argv[1])); gx, gy = map(int, sys.argv[2].split(',')); raw = json.load(open(sys.argv[3]))
ticks = {}
for e in d['reads']: ticks[e['tick']] = e
prev = None; cells = []; arms = []; restarts = []; goal = None; closest = (1e9, None)
for t in sorted(ticks):
    e = ticks[t]
    c = (int(e['x'] // 16), int((e['y'] + 1) // 16))
    if not cells or cells[-1][0] != c: cells.append((c, t, raw.get(f'{c[0]},{c[1]}')))
    if prev and (e['hits_timer'] or 0) > (prev['hits_timer'] or 0): arms.append({'t': t, 'x': round(e['x'], 1), 'y': round(e['y'], 1), 'cell': c, 'tile': raw.get(f'{c[0]},{c[1]}'), 'hits': e['hits'],
        'cause': 'enemy' if e['hits'] > prev['hits'] else ('lava/zero-damage hit' if raw.get(f'{c[0]},{c[1]}') == 17 else 'zero-damage hit'),
        'near': [f"{x['c']}({x['x']:.0f},{x['y']:.0f}) {math.hypot(x['x']-e['x'], x['y']-e['y']):.1f}px" for x in e['en'] if math.hypot(x['x']-e['x'], x['y']-e['y']) < 24]})
    if prev and abs(e['x'] - prev['x']) + abs(e['y'] - prev['y']) > 24: restarts.append({'t': t, 'from': (round(prev['x'], 1), round(prev['y'], 1))})
    if goal is None and c == (gx, gy) and not restarts: goal = {'t': t, 'x': round(e['x'], 1), 'y': round(e['y'], 1)}
    for x in e['en']:
        dd = math.hypot(x['x'] - e['x'], x['y'] - e['y'])
        if dd < closest[0]: closest = (round(dd, 1), {'t': t, 'who': f"{x['c']}({x['x']:.0f},{x['y']:.0f})"})
    prev = e
first_arm = arms[0]['t'] if arms else None
yes = goal is not None and (first_arm is None or first_arm > goal['t']) and (not restarts or restarts[0]['t'] > goal['t'])
print(json.dumps({'tape': d['row']['tape'], 'verdict': 'GAME YES' if yes else ('GAME NO?' if goal is None else 'hit before goal'), 'goal': goal, 'hitArms': arms, 'restarts': restarts,
                  'cells': [f"{c[0]},{c[1]}@t{t}(t={tt})" for c, t, tt in cells], 'closestEnemy': closest, 'ticks': d['row']['ticks']}, indent=None))
