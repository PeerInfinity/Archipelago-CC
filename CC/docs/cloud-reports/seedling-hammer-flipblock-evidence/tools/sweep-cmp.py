import json,sys
def load(d):
  return {json.loads(l)['key']:json.loads(l) for l in open(d+'/merged/rows.jsonl')}
off=load('full-off')
for arm in sys.argv[1:]:
  on=load(arm); print('==',arm, 'legs',len(on))
  for k in sorted(on):
    a=off.get(k); b=on[k]
    ea=a and a['end']; eb=b['end']
    ha=a and (a.get('roomHits') or {}).get('max'); hb=(b.get('roomHits') or {}).get('max')
    if ea!=eb or ha!=hb: print('  ',ea,'->',eb,'hits',ha,'->',hb, k[:110])
