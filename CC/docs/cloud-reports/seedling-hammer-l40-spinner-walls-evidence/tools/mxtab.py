import json,sys
for f in sys.argv[1:]:
  for l in open(f):
    o=json.loads(l)
    if o.get('err'): print(o['seam'], o['envs'], 'ERR/timeout'); continue
    m=o.get('message','')
    on=','.join(x.replace('SEEDLING_','') for x in o['on'])
    w = (m[m.find(' at ('):m.find(' in level')] + (' NOPHASE' if 'NO PHASE' in m else (' LANDED' if 'LANDED' in m else ''))) if 'no step out' in m else m[:120]
    print(o['key'][27:33], o['seam'], on or 'OFF', 'OK ' if o['ok'] else 'REF', o.get('ticks'), 'hits', o.get('hits') if o['ok'] else '', o.get('sha',''), o['ms'], '' if o['ok'] else w)
