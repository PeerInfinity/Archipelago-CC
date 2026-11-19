# rules-l77-trap-chase-witness: summarise play.mjs game runs: hits, deaths (dead_frames rises), trap removal, min distance to the trap.
import sys, gzip, json
for f in sys.argv[1:]:
    d = json.load(gzip.open(f)); r = [x for x in d['reads'] if x['tick'] >= 1]
    seen = False; gone = None
    for x in r:
        has = any('LavaTrap' in m for m in x['mob']) if '--any' in sys.argv else any('LavaTrap(104.0,200.0)' in m for m in x['mob'])
        if has: seen = True
        elif seen and gone is None and x['level'] == 77: gone = x['tick']
    l77 = [x for x in r if x['level'] == 77]
    mind = min((((x['x'] - 104) ** 2 + (x['y'] - 200) ** 2) ** .5, x['tick']) for x in l77) if l77 else None
    df = [x['dead_frames'] for x in r]
    print(f.split('/')[-1].replace('.game.json.gz', ''), json.dumps({'verdict': d['row'].get('verdict'), 'hits': max(x['hits'] for x in r),
        'deadFrames': [min(df), max(df)], 'levels': d['row'].get('levels'), 'trapGone': gone,
        'minDistL77': [round(mind[0], 2), mind[1]] if mind else None, 'end': d['row'].get('end'), 'ticks': d['row'].get('ticks')}))
