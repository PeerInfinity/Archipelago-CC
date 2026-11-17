"""Vanilla-placement spheres of a rules doc (each location's `item`), from Menu: sphere k = the locations reachable with
the items of spheres < k. Usage: vanillaSpheres.py <base rules.json> <tip rules.json> -> every location whose sphere moved."""
import json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from routeWalk import ev
def spheres(doc):
    regs = doc['regions']['1']
    held = {}; got = {}; k = 0
    while True:
        seen = {'Menu'}; stack = ['Menu']
        while stack:
            u = stack.pop()
            for e in regs.get(u, {}).get('exits', []):
                if e['connected_region'] not in seen and ev(e.get('access_rule'), held): seen.add(e['connected_region']); stack.append(e['connected_region'])
        new = [l for n in seen for l in regs[n].get('locations', []) if l['name'] not in got and ev(l.get('access_rule'), held)]
        if not new: return got
        for l in new:
            got[l['name']] = (k, l.get('item'))
        for l in new:
            it = l.get('item'); it = it.get('name') if isinstance(it, dict) else it
            if it: held[it] = held.get(it, 0) + 1
        k += 1
a = spheres(json.load(open(sys.argv[1]))); b = spheres(json.load(open(sys.argv[2])))
print('locations in spheres: base', len(a), 'tip', len(b), '| last sphere base', max(v[0] for v in a.values()), 'tip', max(v[0] for v in b.values()))
moved = [(n, a.get(n), b.get(n)) for n in sorted(set(a) | set(b)) if (a.get(n) or (None,))[0] != (b.get(n) or (None,))[0]]
for n, x, y in moved: print(f'  {n}: sphere {x[0] if x else None} -> {y[0] if y else None} (item {(x or y)[1]})')
print('MOVED', len(moved))
