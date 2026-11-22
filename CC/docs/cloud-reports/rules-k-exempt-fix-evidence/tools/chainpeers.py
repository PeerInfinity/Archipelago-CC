"""rules-k-exempt-fix: for each (b) chain in a kchains.json, the PEER exits on the other side and whether their tiles are
4-connected there (so the chain is one physical doorway on both sides, not two doors to the same level)."""
import json, sys
atlas = json.load(open(sys.argv[2] if len(sys.argv) > 2 else 'frontend/modules/flashPanel/atlases/seedling-playthrough.json'))
regions = {r['region_id']: r for r in atlas['regions']}
peer = {}
for c in atlas['vanilla_layout']['connections']:
    peer[tuple(c['from'])] = tuple(c['to']); peer[tuple(c['to'])] = tuple(c['from'])
data = json.load(open(sys.argv[1]))
seen = set()
for lv in data['levels']:
    for b in lv['bodies']:
        for ch in b['chains']:
            key = (lv['level'], tuple(tuple(x['cell']) for x in ch['cells']))
            if key in seen: continue
            seen.add(key)
            tiles = []
            for x in ch['cells']:
                for e in x['exits']:
                    eid = e.split('->')[0]
                    p = peer.get((f"level_{lv['level']}", eid))
                    if not p: continue
                    ex = next(z for z in regions[p[0]]['exits'] if z['exit_id'] == p[1])
                    tiles += [tuple(t) for t in ex.get('exit_tiles', []) + [ex['entrance_tile']]]
            tiles = sorted(set(tiles))
            # 4-connected?
            comp = {tiles[0]}; stack = [tiles[0]]
            while stack:
                a = stack.pop()
                for t in tiles:
                    if t not in comp and abs(t[0]-a[0]) + abs(t[1]-a[1]) == 1: comp.add(t); stack.append(t)
            print(f"L{lv['level']} chain {[x['cell'] for x in ch['cells']]} idents={ch['idents']} peer tiles={tiles} peer-4-connected={len(comp)==len(tiles)}")
