# rules-l77-trap-chase-witness: per body class in a game run, the closest approach to the player (tick, distance,
# both positions) in the boot level.   python3 near.py <run.game.json.gz> [...]
import sys, gzip, json, re, os
for f in sys.argv[1:]:
    d = json.load(gzip.open(f)); r = [x for x in d['reads'] if x['tick'] >= 1]
    lvl = r[0]['level']; best = {}
    for x in r:
        if x['level'] != lvl: continue
        for i, m in enumerate(x['mob']):
            mm = re.match(r'(\w+)\(([-\d.]+),([-\d.]+)\)', m)
            if not mm: continue
            k = f"{mm.group(1)}#{i}"; dd = ((float(mm.group(2)) - x['x']) ** 2 + (float(mm.group(3)) - x['y']) ** 2) ** .5
            if k not in best or dd < best[k][1]: best[k] = (x['tick'], round(dd, 1), (round(x['x'], 1), round(x['y'], 1)), (float(mm.group(2)), float(mm.group(3))))
    print(os.path.basename(f).replace('.game.json.gz', ''), json.dumps({k: v for k, v in sorted(best.items())}))
