"""MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05). For each arrival that DIES idle with no items
(probe-arrivals.mjs), is its region reachable in the rules WITHOUT the item that saves it? The lethal source decides
the item: drown -> Progressive Swim, lava -> Dark Suit. Inventory = every item in the item pool minus that one.
Reachable = a RULES gap (the rules put the player where the game kills them); unreachable = the rules already gate it.
The precise test: the EDGE that lands on the spawn (the neighbour's exit into this region, read from the AP_1 payload's
targetRegion) must be open, from a reachable source, without the item.
Usage: arrival_rules_check.py <rules.json> <probe-arrivals.json> <AP_1_rules.json (payloads)>"""
import json,sys,collections
j=json.load(open(sys.argv[1])); R=j['regions']['1']
pool=collections.Counter()
for k,v in (j.get('itempool',{}).get('1') or {}).items(): pool[k]=v
if not pool:
    for loc in j.get('locations',{}).get('1',{}).values() if isinstance(j.get('locations',{}).get('1'),dict) else []:
        pass
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
def forward(inv):
    reach={'Menu'}
    while True:
        new=set(reach)
        for n in reach:
            for e in R[n].get('exits',[]):
                if ok(e.get('access_rule'),inv,reach): new.add(e['connected_region'])
        if new==reach: return reach
        reach=new
# every item name any rule mentions, at a high count
names=set()
def walk(r):
    if not r: return
    a=r.get('args',{})
    if 'item_name' in a: names.add(a['item_name'])
    for n in a.get('item_names',[]): names.add(n)
    for c in r.get('children',[]): walk(c)
for n,v in R.items():
    for e in v.get('exits',[]): walk(e.get('access_rule'))
SAVES={'drown':'Progressive Swim','lava':'Dark Suit'}
p=json.load(open(sys.argv[2]))
out=[]
for r in p['rows']:
    d=r['none']
    if not d['deaths']: continue
    src=json.loads(d['firstDeath'])['source']
    item=SAVES.get(src)
    inv=collections.Counter({n:99 for n in names if n!=item})
    reach=forward(inv)
    regions=sorted({x.split('/')[0] for x in r['regions']})
    side=json.load(open(sys.argv[3]))['preset_sidecars']['1'] if not globals().get('SIDE') else SIDE
    globals()['SIDE']=side
    hit=[]
    for x in r['regions']:
        reg,ex=x.split('/')
        e=next((e for e in side[reg]['playable_payload']['exits'] if e['exit_id']==ex),None)
        nb=e and e.get('targetRegion')
        if not nb or nb not in reach: continue
        for back in R.get(nb,{}).get('exits',[]):
            if back['connected_region']==reg and ok(back.get('access_rule'),inv,reach): hit.append(f'{nb} -> {reg}')
    out.append({'level':r['level'],'x':r['x'],'y':r['y'],'source':src,'savedBy':item,'regions':regions,'reachableWithout':hit,'diesWithAll':bool(r['all']['deaths'])})
    print(f"L{r['level']} ({r['x']},{r['y']}) {src:6} needs {item}: landing edge open without it: {hit or 'NONE'}")
print('RULES-gap arrivals (reachable without the saving item):', sum(1 for o in out if o['reachableWithout'] and o['savedBy']))
