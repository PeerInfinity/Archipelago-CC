import json,sys
for f in sys.argv[1:]:
  print('==', f.split('/')[-1])
  for l in open(f):
    o=json.loads(l)
    if o.get('err'): print(o['seam'],'ERR'); continue
    m=o.get('message','')
    w = (m[m.find(' at ('):m.find(' in level')] + (' NOPHASE' if 'NO PHASE' in m else (' LANDED' if 'LANDED' in m else ''))) if 'no step out' in m else m[:110]
    print(o['seam'], 'OK ' if o['ok'] else 'REF', o.get('ticks'), 'hits', len(o.get('hits') or []), ' '.join(o['passes']), o.get('sha',''), '' if o['ok'] else w)
