# Igneous-to-Lava (t=31) conversion on a game trace (Tile.as:390-424): the countdown runs while the PLAYER ORIGIN is within
# sqrt(16²+16²)/2 = 11.31 px of the tile centre (`FP.distance(p.x, p.y, x, y)`; a Tile's x,y is its centre, Tile.as:103);
# igneousCounterMax = 8 (Tile.as:83) → igneousBreakApart on the 9th in-range frame; then one sprIgneousLava frame per 9
# frames, 3 frames (IgneousLava.png is 48×16, Game.as:278-279) → t = 17 on frame 36 after the first in-range frame.
# Prints, per igneous tile of the level, the in-range frames, the predicted conversion frame, and whether the state sample
# point (x, y+1) stands on that tile at/after it; plus the first hits_timer arm. usage: python3 igneous.py <raw.json> <run.gz>...
import gzip, json, math, sys
raw = json.load(open(sys.argv[1])); R = math.sqrt(16 * 16 * 2) / 2
ign = [tuple(map(int, k.split(','))) for k, v in raw.items() if v == 31]
for f in sys.argv[2:]:
    d = json.load(gzip.open(f)); ticks = {}
    for e in d['reads']: ticks.setdefault(e['tick'], e)
    life = sorted(t for t in ticks if t > 0)
    restart = next((t for t in life if t > 1 and abs(ticks[t]['y'] - ticks[life[life.index(t) - 1]]['y']) + abs(ticks[t]['x'] - ticks[life[life.index(t) - 1]]['x']) > 24), None)
    first_arm = next((t for t in sorted(ticks) if (ticks[t]['hits_timer'] or 0) > 0), None)
    print(f"== {d['row']['tape']}: first hits_timer arm t{first_arm}, restart t{restart}")
    for (cx, cy) in ign:
        ox, oy = cx * 16 + 8, cy * 16 + 8
        ins = [t for t in sorted(ticks) if (restart is None or t < restart) and math.hypot(ticks[t]['x'] - ox, ticks[t]['y'] - oy) <= R]
        if not ins: continue
        conv = ins[8] + 27 + 1 if len(ins) >= 9 else None
        on = [t for t in sorted(ticks) if conv and t >= conv and (restart is None or t < restart) and int(ticks[t]['x'] // 16) == cx and int((ticks[t]['y'] + 1) // 16) == cy]
        print(f"  ({cx},{cy}) in range t{ins[0]}..t{ins[-1]} ({len(ins)} frames) -> lava at t{conv}" + (f"; sample point ON it t{on[0]}..t{on[-1]}" if on else ''))
