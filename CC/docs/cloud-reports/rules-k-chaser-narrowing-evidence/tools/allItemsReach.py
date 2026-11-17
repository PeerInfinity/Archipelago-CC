"""With EVERY item, from the game's start regions: which regions/locations are reachable (a seal check: a K/T charge must
never make anything unreachable). Usage: allItemsReach.py <rules.json> <rules.json>"""
import json, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from routeWalk import ev, items_of
def reach(doc):
    regs = doc['regions']['1']
    its = set()
    for g in regs.values():
        for e in g.get('exits', []): items_of(e.get('access_rule'), its)
        for l in g.get('locations', []): items_of(l.get('access_rule'), its)
    held = {}
    for n, c in its: held[n] = max(held.get(n, 0), c)
    # regions with no way in from another region are the starts
    into = {e['connected_region'] for g in regs.values() for e in g.get('exits', [])}
    starts = [n for n in regs if n not in into] or list(regs)[:1]
    seen = set(starts); stack = list(starts)
    while stack:
        u = stack.pop()
        for e in regs[u].get('exits', []):
            if e['connected_region'] not in seen and ev(e.get('access_rule'), held): seen.add(e['connected_region']); stack.append(e['connected_region'])
    locs = {l['name'] for n in seen for l in regs[n].get('locations', []) if ev(l.get('access_rule'), held)}
    alllocs = {l['name'] for g in regs.values() for l in g.get('locations', [])}
    return locs, alllocs
a, aa = reach(json.load(open(sys.argv[1]))); b, ba = reach(json.load(open(sys.argv[2])))
print('locations reachable with every item: base', len(a), '/', len(aa), ' tip', len(b), '/', len(ba))
print('lost at tip:', sorted(a - b)); print('gained at tip:', sorted(b - a))
