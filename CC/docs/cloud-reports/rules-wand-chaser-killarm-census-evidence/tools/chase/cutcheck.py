# rules-l77-trap-chase-witness: did a game run CROSS a K cut? Reads the prior slice's guards-tip.txt (every K cut by
# level) and a play.mjs run; prints, per guard of the run's boot level, the cut cells the player's tile stood on
# (in tick order) and whether that body was still alive then.   python3 cutcheck.py <run.game.json.gz> [...]
import sys, gzip, json, re, os
here = os.path.dirname(os.path.abspath(__file__))
G = open(os.path.join(here, '../../../rules-chaser-arrival-killarm-evidence/runs/guards-tip.txt')).read()
cuts = {}
for m in re.finditer(r'^L(\d+) K (\S+) speed \S+ leash \S+: zone \d+, cut \d+: (.*)$', G, re.M):
    cuts.setdefault(int(m.group(1)), []).append((m.group(2), set(tuple(map(int, c.split(','))) for c in m.group(3).split())))
for f in sys.argv[1:]:
    d = json.load(gzip.open(f)); r = [x for x in d['reads'] if x['tick'] >= 1]
    lvl = r[0]['level'] if r else None
    out = []
    for body, cells in cuts.get(lvl, []):
        hit = []
        for x in r:
            if x['level'] != lvl: continue
            t = (int(x['x'] // 16), int(x['y'] // 16))
            if t in cells and (not hit or hit[-1][1] != t): hit.append((x['tick'], t))
        out.append(f"{body}: {len(cells)} cut cells; stood on {len(hit)}: " + ' '.join(f"t{a}@{b[0]},{b[1]}" for a, b in hit[:12]))
    print(os.path.basename(f).replace('.game.json.gz', ''), f'L{lvl}:', ' | '.join(out) or 'no K guards')
