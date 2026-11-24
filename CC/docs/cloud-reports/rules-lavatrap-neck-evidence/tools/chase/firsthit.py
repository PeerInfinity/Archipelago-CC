# rules-l77-trap-chase-witness: who hit first. For a play.mjs run: the first tick the hit count rises in the boot level,
# the player's position, and every body within 28 px then (class, distance).   python3 firsthit.py <run.game.json.gz> [...]
import sys, gzip, json, re, os, math
for f in sys.argv[1:]:
    d = json.load(gzip.open(f)); r = [x for x in d['reads'] if x['tick'] >= 1]
    lvl = r[0]['level']; prev = 0; out = None
    for x in r:
        if x['level'] == lvl and x['hits'] > prev:
            near = []
            for m in x['mob']:
                mm = re.match(r'(\w+)\(([-\d.]+),([-\d.]+)\)', m)
                if mm:
                    dd = math.hypot(float(mm.group(2)) - x['x'], float(mm.group(3)) - x['y'])
                    if dd < 28: near.append(f"{mm.group(1)}({mm.group(2)},{mm.group(3)})@{dd:.1f}")
            out = f"t{x['tick']} at ({x['x']:.1f},{x['y']:.1f}) near: {', '.join(near) or 'none within 28 px (lava/hazard?)'}"; break
        prev = x['hits'] if x['level'] == lvl else prev
    print(os.path.basename(f).replace('.game.json.gz', ''), out or 'no hit in boot level')
