import json,sys
rows=[json.loads(l) for l in open(sys.argv[1])]
print(f"{'solve':<22}{'order':<12}{'ok':<5}{'ticks':>6}{'work':>6}  {'gm':<10}{'digest':<14}approach (side, via, wait, forks, anchor, rank)")
for r in sorted(rows, key=lambda r:(str(r['id']),str(r['i']),r['arm']!='OFF',r['arm'])):
    gm=r.get('gm') or {}
    g='-' if not r['ok'] else ('hitless' if (gm.get('hits') in ([],0)) and gm.get('deaths')==0 else 'HIT '+json.dumps(gm)[:40])
    ap='; '.join(f"{a['side']} {('%s,%s'%(a['via']['x'],a['via']['y'])) if a.get('via') else 'corr'} w{a.get('wait')} f{a['forks']} a{a.get('anchor')} r{a.get('rank')}" for a in r['approaches'])
    print(f"{str(r['id'])+'/'+str(r['i']):<22}{r['arm']:<12}{'ok' if r['ok'] else 'REF':<5}{str(r.get('ticks')):>6}{str(r.get('work','')):>6}  {g:<10}{r['digest']:<14}{ap}" + ('' if r['ok'] else '  | '+(r.get('head') or '')[:110]))
