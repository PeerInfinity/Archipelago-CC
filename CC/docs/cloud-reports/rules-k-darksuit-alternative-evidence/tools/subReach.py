"""Minimal item sets that open sub-region A -> B inside one level of an atlas (its subgraph internal_exits, both ways
where bidirectional). Usage: subReach.py <atlas.json> <level_NN> <from> <to>"""
import json, sys, itertools
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from routeWalk import ev, items_of
atlas, lvl, src, dst = sys.argv[1:5]
r = [x for x in json.load(open(atlas))['regions'] if x['region_id'] == lvl][0]
sg = r['subgraph']; edges = []
for e in sg['internal_exits']:
    edges.append((e['from'], e['to'], e.get('access_rule')))
    if e.get('bidirectional'): edges.append((e['to'], e['from'], e.get('access_rule')))
its = set()
for *_, rule in edges: items_of(rule, its)
its = sorted(its)
def reach(held):
    seen = {src}; st = [src]
    while st:
        n = st.pop()
        for a, b, rule in edges:
            if a == n and b not in seen and ev(rule, held): seen.add(b); st.append(b)
    return dst in seen
mins = []
for k in range(len(its) + 1):
    for combo in itertools.combinations(its, k):
        s = set(combo)
        if any(m <= s for m in mins): continue
        if reach({n: c for n, c in combo}): mins.append(s)
print(lvl, src, '->', dst, 'sub_regions' if src in sg['sub_regions'] and dst in sg['sub_regions'] else 'MISSING', sorted(sorted(f'{n}x{c}' if c > 1 else n for n, c in m) for m in mins))
