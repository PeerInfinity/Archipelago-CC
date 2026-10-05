"""MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05). Every kill-lock (`lock`/`grasslock`/`wandlock`
with tset -1, the overlay's `lockRuling` GATED(A_WEAPON) arm) and whether its room is reachable in the rules with NO
items (sphere 0) — where a weapon ruling, if charged, would be strict (the L5 finding).
Usage: killlock_census.py <seedling-map.json> <rules.json>"""
import json,sys,collections
atlas=json.load(open(sys.argv[1])); j=json.load(open(sys.argv[2])); R=j['regions']['1']
def ok(rule,inv,reach):
    if not rule: return True
    k=rule['rule']
    if k=='True_': return True
    if k=='Has': return inv[rule['args']['item_name']]>=rule['args'].get('count',1)
    if k=='HasAny': return any(inv[n]>=1 for n in rule['args']['item_names'])
    if k=='HasAll': return all(inv[n]>=1 for n in rule['args']['item_names'])
    if k=='And': return all(ok(c,inv,reach) for c in rule['children'])
    if k=='Or': return any(ok(c,inv,reach) for c in rule['children'])
    if k=='CanReachRegion': return rule['args']['region_name'] in reach
    raise ValueError(k)
reach={'Menu'}; inv=collections.Counter()
while True:
    new=set(reach)
    for n in reach:
        for e in R[n].get('exits',[]):
            if ok(e.get('access_rule'),inv,reach): new.add(e['connected_region'])
    if new==reach: break
    reach=new
lv0={int(n.split('__')[0].split('_')[1]) for n in reach if n.startswith('level_')}
rows=[]
for L in atlas['levels']:
    for e in L['entities']:
        if e['type'] in ('lock','grasslock','wandlock') and e['attrs'].get('tset')=='-1':
            rows.append((L['level'],e['type'],e['x'],e['y'],e['attrs'].get('tag'),L['level'] in lv0))
print('kill-locks:',len(rows),'in a sphere-0 room:',sum(r[5] for r in rows))
for r in rows: print(' L%d %s@%d,%d tag %s %s'%(r[0],r[1],r[2],r[3],r[4],'SPHERE-0 ROOM' if r[5] else ''))
