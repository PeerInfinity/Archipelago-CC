#!/usr/bin/env python3
"""unbounded-grid-components — for each rules.json: the adjacency components of its grid (cells
joined by a NON-teleporter exit pair on a shared side), their count, the largest one's bbox, and the
bbox of everything. Separates the dense "core" from teleport-placed outliers, so a huge-box world's
sprawl can be split into "the core grew" vs "teleport targets were flung far".

  python3 scripts/dev/unbounded-grid-components.py <rules.json> ...   (survey unbounded-grid-survey)
"""
import json
import sys

D = {'N': (0, -1), 'S': (0, 1), 'E': (1, 0), 'W': (-1, 0)}
for f in sys.argv[1:]:
    d = json.load(open(f))
    sc = d['preset_sidecars']['1']
    cell = {n: (r['grid_cell']['gx'], r['grid_cell']['gy']) for n, r in sc.items() if r.get('grid_cell')}
    adj = {n: set() for n in cell}
    for n, r in sc.items():
        for e in (r.get('playable_payload') or {}).get('exits') or []:
            t = e.get('targetRegion')
            if e.get('isTeleporter') or t not in cell or n not in cell:
                continue
            adj[n].add(t); adj[t].add(n)
    seen, comps = set(), []
    for n in cell:
        if n in seen:
            continue
        st, comp = [n], []
        seen.add(n)
        while st:
            x = st.pop(); comp.append(x)
            for y in adj[x]:
                if y not in seen:
                    seen.add(y); st.append(y)
        comps.append(comp)
    comps.sort(key=len, reverse=True)
    def bbox(ns):
        xs = [cell[n][0] for n in ns]; ys = [cell[n][1] for n in ns]
        return (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)
    big = comps[0]
    print(f"{f.split('/')[-1]}: regions={len(cell)} components={len(comps)} sizes(top5)={[len(c) for c in comps[:5]]} "
          f"largest_bbox={bbox(big)[0]}x{bbox(big)[1]} all_bbox={bbox(list(cell))[0]}x{bbox(list(cell))[1]} "
          f"fill(all)={len(cell)/(bbox(list(cell))[0]*bbox(list(cell))[1]):.3f}")
