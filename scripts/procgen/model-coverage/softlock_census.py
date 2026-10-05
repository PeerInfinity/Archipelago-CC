"""Rule-aware soft-lock census: per sphere's cumulative inventory, regions reachable from the start whose way back
to the start needs items not yet held.
Copied from the rules-reclosing-locks slice's evidence script (2026-10-05) for slice rules-model-coverage-inventory
(MEASURE ONLY); adds `--warp`, which models the restart warp (every region -> Menu, True_) the rules arc is adding.
Usage: softlock_census.py <rules.json> <sphere_log.jsonl> [out.json] [--warp]"""
import json,sys,collections
WARP='--warp' in sys.argv; sys.argv=[a for a in sys.argv if a!='--warp']
j=json.load(open(sys.argv[1])); R=j['regions']['1']
if WARP:
    for n,v in R.items():
        if n!='Menu': v.setdefault('exits',[]).append({'connected_region':'Menu','access_rule':{'rule':'True_'}})
start=R['Menu']['exits'][0]['connected_region']
inv=collections.Counter(); rows=[]
for line in open(sys.argv[2]):
    r=json.loads(line)
    if r.get('type')!='state_update': continue
    for k,v in r['player_data']['1']['new_inventory_details']['base_items'].items(): inv[k]+=v
    rows.append((r['sphere_index'],collections.Counter(inv)))
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
def back(inv,reach):
    # regions (within reach) from which `start` is reachable over edges open under inv
    rev=collections.defaultdict(set)
    for n in reach:
        for e in R[n].get('exits',[]):
            if ok(e.get('access_rule'),inv,reach): rev[e['connected_region']].add(n)
    seen={start}; st=[start]
    while st:
        a=st.pop()
        for b in rev[a]:
            if b not in seen: seen.add(b); st.append(b)
    return seen
def rs(r):
    if not r: return 'True_'
    k=r['rule']
    if k=='Has': return r['args']['item_name']
    if k in ('HasAny','HasAll'): return k+'('+','.join(r['args']['item_names'])+')'
    if k=='CanReachRegion': return 'Reach('+r['args']['region_name']+')'
    if k in ('And','Or'): return k+'('+', '.join(rs(c) for c in r['children'])+')'
    return k
out={}; cuts={}
for s,inv in rows:
    f=forward(inv); b=back(inv,f)
    soft=sorted(x for x in f if x not in b and x!='Menu')
    out[s]=soft
    # the CUT: closed exits from a soft-locked region (the ways back that need an item not held)
    cuts[s]=sorted({f"{n} -> {e['connected_region']} [{rs(e.get('access_rule'))}]" for n in soft for e in R[n].get('exits',[])
                    if not ok(e.get('access_rule'),inv,f)})
    print(f'sphere {s:>5}  reach {len(f):3}  soft-locked {len(soft):3}  ' + ' '.join(soft))
json.dump({'soft':out,'cuts':cuts},open(sys.argv[3],'w'),indent=1) if len(sys.argv)>3 else None
