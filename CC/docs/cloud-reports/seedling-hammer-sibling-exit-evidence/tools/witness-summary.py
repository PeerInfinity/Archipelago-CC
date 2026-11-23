import json,sys
for l in open(sys.argv[1]):
    r=json.loads(l)
    sib=r.get('sibling') or {}
    plans=r.get('plans') or []
    rh=r.get('roomHits') or {}
    print(json.dumps({'key':r['key'][:60],'end':r.get('end'),'level':r.get('level'),'xy':[r.get('x'),r.get('y')],
      'hits':[(h.get('level'),h.get('t'),h.get('d'),h.get('x'),h.get('y')) for h in rh.get('hits',[])],'atArrival':rh.get('atArrival'),'max':rh.get('max'),
      'plans':[(p.get('ok'),p.get('ticks'),(p.get('siblingExit') or {}).get('chosen')) for p in plans],
      'goalSame':sib.get('goalSame'),'siblings':len(sib.get('siblings',[])),
      'moves':[(m.get('sourceRegion'),m.get('exitName'),m.get('targetRegion')) for m in sib.get('regionMoves',[])],
      'tapes':[(t.get('name'),t.get('ticks')) for t in r.get('tapes',[])][-3:], 'failed': r.get('failed'), 'solverEnv': r.get('solverEnv')}))
