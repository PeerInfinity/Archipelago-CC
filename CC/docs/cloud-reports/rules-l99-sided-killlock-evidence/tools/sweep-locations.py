"""rules-l99-sided-killlock: an item-aware sweep of one rules.json (its own placements), printing every location's sweep
index and the goal. Events are collected to a fixed point inside the sweep they unlock (as AP's sweep does).
Usage: python3 sweep-locations.py <rules.json>"""
import json, sys
from collections import Counter
d = json.load(open(sys.argv[1])); regs = d['regions']; regs = regs.get('1', regs)
START = d.get('start_regions', {}).get('1', {}).get('default', ['Menu'])
def ok(r, inv):
    k = r['rule']; a = r.get('args', {})
    if k == 'True_': return True
    if k == 'False_': return False
    if k == 'Has': return inv[a['item_name']] >= a.get('count', 1)
    if k == 'HasAny': return any(inv[i] >= 1 for i in a['item_names'])
    if k == 'HasAll': return all(inv[i] >= 1 for i in a['item_names'])
    if k == 'HasAnyCount': return any(inv[i] >= n for i, n in a['item_counts'].items())
    if k == 'HasAllCounts': return all(inv[i] >= n for i, n in a['item_counts'].items())
    if k == 'And': return all(ok(c, inv) for c in r['children'])
    if k == 'Or': return any(ok(c, inv) for c in r['children'])
    raise ValueError(k)
inv = Counter(); got = {}; rsph = {}; s = 0
def reach():
    seen = set(START); q = list(START)
    while q:
        r = q.pop()
        for e in regs[r].get('exits', []):
            t = e['connected_region']
            if t not in seen and ok(e['access_rule'], inv): seen.add(t); q.append(t)
    return seen
def avail(seen, ev):
    return [(l['name'], l['item']['name']) for r in seen for l in regs[r].get('locations', [])
            if l['name'] not in got and bool(l.get('event')) == ev and ok(l['access_rule'], inv)]
while True:
    while True:
        seen = reach(); evs = avail(seen, True)
        if not evs: break
        for n, it in evs: got[n] = s; inv[it] += 1
    for r in seen: rsph.setdefault(r, s)
    new = avail(seen, False)
    if not new: break
    for n, it in new: got[n] = s; inv[it] += 1
    s += 1
alll = [l['name'] for r in regs.values() for l in r.get('locations', [])]
goal = d.get('game_info', {}).get('1', {}).get('completion_condition', {})
print(f"# {sys.argv[1]}")
print(f"regions reached {len(rsph)}/{len(regs)}; locations reached {len(got)}/{len(alll)}; goal {json.dumps(goal)} -> "
      f"{'REACHED' if goal.get('item') is None or inv[goal.get('item')] > 0 else 'NOT REACHED'}; sweeps {s + 1}")
for n in sorted(alll, key=lambda n: (got.get(n, 99), n)): print(f"{got.get(n, 'UNREACHED')}\t{n}")
