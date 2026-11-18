# tab.py <clocks.jsonl>... : one row per (leg, clock): verdict, ticks, hits, passes, sha, wall s, the wall's words
import json,sys
for f in sys.argv[1:]:
  print('==', f.split('/')[-1])
  rows=[json.loads(l) for l in open(f) if l.strip()]
  for o in sorted(rows, key=lambda o:(o['leg'],o['seam'])):
    if o.get('err'): print(o['leg'],o['seam'],'ERR'); continue
    m=o.get('message','')
    if 'no step out' in m: w='no step out'+m[m.find(' at ('):m.find(' in level')]+(' LANDED' if 'LANDED' in m else '')
    elif 'EXHAUSTED' in m: w='combat ladder EXHAUSTED'
    elif 'deadline' in m: w='anytime deadline'
    else: w=m[:90]
    v='HIT' if o['ok'] and o.get('hits') else ('OK ' if o['ok'] else 'REF')
    sv=o.get('solve') or {}
    print(o['leg'],o['seam'],v,o.get('ticks') or '-','hits',len(o.get('hits') or []),' '.join(o['passes']),o.get('sha','-'),f"{o['ms']/1000:.0f}s",
          f"deep={(o.get('shoved') or {}).get('deepened','-')} cut={sv.get('chaserCut','-')} spentS={sv.get('solveSpent','-')}", '' if o['ok'] else w)
