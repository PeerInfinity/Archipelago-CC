#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sc D2): summarise the lab's per-derivation strike-scan records (SC_LAB=census).
usage: sc-census.py <wl.jsonl>... → one JSON line per workload, then the derivations whose CHOSEN strike differs."""
import json, sys
for p in sys.argv[1:]:
    rows = [json.loads(l) for l in open(p) if l.strip()]
    wl = p.rsplit('/', 1)[-1].replace('.jsonl', '')
    s = dict(wl=wl, derivations=len(rows), cont=sum(r['cont'] for r in rows))
    for k in 'AB':
        s[f'pairs{k}'] = sum(r[k]['pairs'] for r in rows)
        s[f'previews{k}'] = sum(r[k]['previews'] for r in rows)
        s[f'ms{k}'] = round(sum(r[k]['ms'] for r in rows), 1)
        s[f'refused{k}'] = sum(1 for r in rows if r[k]['res'] and r[k]['res'].get('cell') is None)
    w = [r['wA'] for r in rows] + [r['wB'] for r in rows]
    s['walksArrivedA'] = sum(r['wA']['arrived'] for r in rows)
    s['underA'] = sum(r['wA']['underA'] for r in rows)
    s['underA_inB'] = sum(r['wB']['underA'] for r in rows)
    s['maxFloorAminusEta'] = max([x['maxAminusEta'] for x in w if x['arrived']] or [None])
    s['underB'] = sum(x['underB'] for x in w)
    s['minEtaMinusFloorB'] = min([x['minEtaMinusB'] for x in w if x['arrived']] or [None])
    s['maxStep'] = round(max([x['maxStep'] for x in w] or [0]), 3)
    s['keptDiffer'] = sum(1 for r in rows if r['A']['kept'] != r['B']['kept'])
    diff = [r for r in rows if json.dumps(r['A']['res'], sort_keys=True) != json.dumps(r['B']['res'], sort_keys=True)]
    cellDiff = [r for r in diff if (r['A']['res'] or {}).get('cell') != (r['B']['res'] or {}).get('cell')
                or (r['A']['res'] or {}).get('pressAt') != (r['B']['res'] or {}).get('pressAt')
                or (r['A']['res'] or {}).get('eta') != (r['B']['res'] or {}).get('eta')]
    s['resDiffer'] = len(diff); s['chosenDiffer'] = len(cellDiff)
    s['chosenDiffer_refusedA_foundB'] = sum(1 for r in cellDiff if (r['A']['res'] or {}).get('cell') is None and (r['B']['res'] or {}).get('cell') is not None)
    s['dropped'] = sum(r.get('drop', {}).get('dropped', 0) for r in rows)
    s['droppedReach'] = sum(r.get('drop', {}).get('reach', 0) for r in rows)
    s['droppedPlan'] = sum(r.get('drop', {}).get('plan', 0) for r in rows)
    s['derivWithDroppedPlan'] = sum(1 for r in rows if r.get('drop', {}).get('plan', 0) > 0)
    s['threwB'] = sum(1 for r in rows if 'threw' in (r['B']['res'] or {}))
    worst = max((x for x in w if x['arrived'] and x.get('worst')), key=lambda x: x['maxAminusEta'], default=None)
    s['worst'] = worst['worst'] if worst else None
    print(json.dumps(s))
    for r in cellDiff[:8]:
        print('  DIFF', json.dumps({'wl': wl, 'n': r['n'], 't': r['t'], 'body': r['body'], 'cont': r['cont'], 'A': r['A']['res'], 'B': r['B']['res'],
              'drop': r.get('drop')}))
