"""rules-k-exempt-entry: every exit/location row of two rules docs as a min-item-set DNF, keyed (region, exit name) /
(region, location): ADD / DEL / CHG, and for a CHG whether the tip is STRICTER, LOOSER or mixed (by DNF implication).
usage: rowdiff.py <base.json> <tip.json>"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from hitrows import dnf
def rows(doc):
    out = {}
    for n, g in doc['regions']['1'].items():
        for e in g.get('exits', []): out[f"{n} -> {e['connected_region']} [{e['name']}]"] = dnf(e.get('access_rule'))
        for l in g.get('locations', []): out[f"{n} : {l['name']}"] = dnf(l.get('access_rule'))
    return out
def sets(d): return [] if d == 'NEVER' else [frozenset() if t == 'FREE' else frozenset(t.split(' & ')) for t in d.split(' | ')]
def implies(a, b):  # every set of a is a superset of some set of b  (a's holders also pass b)
    return all(any(y <= x for y in sets(b)) for x in sets(a))
a, b = (rows(json.load(open(p))) for p in sys.argv[1:3])
n = {'ADD': 0, 'DEL': 0, 'CHG': 0}
for k in sorted(set(a) | set(b)):
    if k not in a: n['ADD'] += 1; print(f"ADD {k} = {b[k]}")
    elif k not in b: n['DEL'] += 1; print(f"DEL {k} = {a[k]}")
    elif a[k] != b[k]:
        n['CHG'] += 1
        v = 'STRICTER' if implies(b[k], a[k]) and not implies(a[k], b[k]) else 'LOOSER' if implies(a[k], b[k]) and not implies(b[k], a[k]) else 'MIXED'
        print(f"CHG {v} {k}\n    base {a[k]}\n    tip  {b[k]}")
print('TOTAL', n)
