# SIBLING-EXIT step 5: the sibling-leg.mjs rows (OFF/ON per leg, the production path) summarised: per leg, did ON ship
# another exit, and the hits/ticks/ms both ways; every mover by KEY; and the extra work per leg (ON ms - OFF ms).
#   python3 census-summary.py <rows.jsonl>...
import json, sys, statistics
rows = [json.loads(l) for f in sys.argv[1:] for l in open(f) if l.strip()]
movers, gained, extra_ms, ran = [], [], [], []
for r in rows:
    off, on = r.get('off') or {}, r.get('on') or {}
    ch = (on.get('siblingExit') or {}).get('chosen')
    named = (on.get('siblingExit') or {}).get('named')
    solved = len((on.get('siblingExit') or {}).get('rows') or [])
    if solved > 1: ran.append(r['key'])
    if isinstance(off.get('ms'), int) and isinstance(on.get('ms'), int): extra_ms.append(on['ms'] - off['ms'])
    if (on.get('replayHits') or 0) > (off.get('replayHits') or 0): gained.append(r['key'])
    if ch and ch != named:
        movers.append(r)
        print('MOVER', json.dumps({'key': r['key'], 'off': {k: off.get(k) for k in ('ticks', 'replayHits', 'hitIds', 'ms')},
            'on': {k: on.get(k) for k in ('ticks', 'replayHits', 'hitIds', 'ms')}, 'chosen': ch, 'landing': (on.get('landing') or {}).get('ctor')}))
    elif off.get('ticks') != on.get('ticks') or off.get('replayHits') != on.get('replayHits'):
        print('CHANGED-WITHOUT-MOVE', r['key'], off.get('ticks'), on.get('ticks'), off.get('replayHits'), on.get('replayHits'))
hit_off = [r['key'] for r in rows if ((r.get('off') or {}).get('replayHits') or 0) > 0]
print(f'legs {len(rows)}; OFF legs with a hit {len(hit_off)}; legs whose siblings were solved ON {len(ran)}; movers {len(movers)}; '
      f'legs that GAINED a hit ON {len(gained)} {gained}')
print('OFF hit legs:', *hit_off, sep='\n  ')
if extra_ms:
    print(f'extra wall ON-OFF ms: median {statistics.median(extra_ms)}, max {max(extra_ms)}; over the legs that solved siblings: '
          + str(sorted((r["on"]["ms"] - r["off"]["ms"]) for r in rows if r["key"] in ran)))
