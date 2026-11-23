# SIBLING-EXIT: two survey --out files compared per step: goals, verdict, ticks, hits/deaths (replay), and the whole row
# with the wall-clock fields dropped (`ms`, and any `*Ms`/`ms` inside). Prints every step that differs, then totals.
#   python3 survey-compare.py <a.json> <b.json> [--movers]
import json, sys
def strip(v):
    if isinstance(v, dict): return {k: strip(x) for k, x in v.items() if not (k == 'ms' or k.endswith('Ms') or k == 'stderr')}
    if isinstance(v, list): return [strip(x) for x in v]
    return v
a = {str(r['step']): r for r in json.load(open(sys.argv[1]))['rows']}
b = {str(r['step']): r for r in json.load(open(sys.argv[2]))['rows']}
def key(r):
    rp = r.get('replay') or {}
    return {'verdict': r.get('verdict'), 'ticks': r.get('ticks'), 'hits': rp.get('hits'), 'deaths': rp.get('deaths'),
            'goals': [{k: g.get(k) for k in ('kind', 'why', 'pit', 'exit', 'placement')} for g in (r.get('goals') or [])]}
same_key = same_row = 0
movers = []
for s in a:
    if s not in b: print('MISSING in b', s); continue
    ka, kb = key(a[s]), key(b[s])
    if ka == kb: same_key += 1
    else: movers.append((s, ka, kb))
    if strip(a[s]) == strip(b[s]): same_row += 1
    elif ka == kb and '--rows' in sys.argv:
        ra, rb = strip(a[s]), strip(b[s])
        print('ROW-DIFF', s, sorted(k for k in set(ra) | set(rb) if ra.get(k) != rb.get(k)))
for s, ka, kb in movers:
    print(json.dumps({'step': s, 'level': a[s].get('level'),
        'a': {k: ka[k] for k in ('verdict', 'ticks', 'hits', 'deaths')}, 'b': {k: kb[k] for k in ('verdict', 'ticks', 'hits', 'deaths')},
        'goalsSame': ka['goals'] == kb['goals'], 'siblingExit': (b[s].get('siblingExit') or {}).get('chosen'),
        'arrivalOverride': b[s].get('arrivalOverride')}))
gained = [s for s, ka, kb in movers if (kb['hits'] or 0) > (ka['hits'] or 0) or (kb['deaths'] or 0) > (ka['deaths'] or 0)]
print(f'steps {len(a)} vs {len(b)}: per-step key equal {same_key}, whole row equal (no wall clock) {same_row}, movers {len(movers)}, '
      f'steps that GAINED a hit/death {len(gained)} {gained}')
