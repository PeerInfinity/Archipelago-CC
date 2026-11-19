import json,sys
B,A=sys.argv[1],sys.argv[2]
for p in ['seedling_playthrough','alttp','procgen_topdown']:
  for s in ['S1','S2','S3','S4','S5','S6','S7']:
    b=json.load(open(f'{B}/{p}/{s}.json')); a=json.load(open(f'{A}/{p}/{s}.json'))
    eb,ea=b['elements'],a['elements']
    added=[k for k in ea if k not in eb]; removed=[k for k in eb if k not in ea]
    changed=[k for k in ea if k in eb and ea[k]!=eb[k]]
    loc_added=[k for k in added if k.startswith(('loc_','edge_'))]
    other_added=[k for k in added if k not in loc_added]
    chg_kinds={}
    for k in changed:
      d={f for f in set(ea[k])|set(eb[k]) if ea[k].get(f)!=eb[k].get(f)}
      if d=={'classes'}:
        diff=tuple(sorted(set(ea[k]['classes'])^set(eb[k]['classes'])))
        chg_kinds[diff]=chg_kinds.get(diff,0)+1
      else: chg_kinds[tuple(sorted(d))]=chg_kinds.get(tuple(sorted(d)),0)+1
    topk=[k for k in set(a)|set(b) if k not in('elements',) and a.get(k)!=b.get(k)]
    hs_b=sum(len(v) for v in (b.get('hoverSweep') or {}).values()); hs_a=sum(len(v) for v in (a.get('hoverSweep') or {}).values())
    print(p[:9],s,f"+loc {len(loc_added)} +other {len(other_added)} -{len(removed)} chg {chg_kinds} top {sorted(topk)} sweep {hs_b}->{hs_a}")
