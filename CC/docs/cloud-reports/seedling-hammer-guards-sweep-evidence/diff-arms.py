# Measure-only: leg-by-leg diff of two divergence-sweep row files (OFF vs ON).
import json, re, sys, collections
def load(p):
    out = {}
    for l in open(p):
        if l.strip():
            r = json.loads(l); out[r['id']] = r
    return out
def sig(r):
    h = r.get('history') or []
    ticks = sum((x.get('ticks') or 0) for x in h)
    deaths = sum(((x.get('expectedEnd') or {}).get('deaths') or 0) for x in h)
    hits = (r.get('roomHits') or {}).get('max')
    msg = r.get('failed') or ''
    # strip float coordinates and tick stamps so a moved seam time does not read as a new answer
    norm = re.sub(r'-?\d+(\.\d+)?', '#', msg)[:240]
    # done and crossed are both a played, successful leg (the probes read them together); the split between them is the
    # harness's drain timing, so the diff reads them as one SOLVE class
    return dict(end='SOLVE' if r['end'] in ('done', 'crossed') else r['end'], ticks=ticks, deaths=deaths, hits=hits, msg=msg, norm=norm,
                guard='PRESS_KILL_' in json.dumps(r), ms=r.get('ms') or 0, key=r['key'])
off, on = load(sys.argv[1]), load(sys.argv[2])
ids = sorted(set(off) & set(on))
print(f'legs: off {len(off)} on {len(on)} common {len(ids)}')
print('end OFF', dict(collections.Counter(off[i]['end'] for i in ids)))
print('end ON ', dict(collections.Counter(on[i]['end'] for i in ids)))
g = [i for i in ids if sig(on[i])['guard']]
print(f'ON rows carrying guard wording: {len(g)} {g}')
print(f'OFF rows carrying guard wording: {sum(sig(off[i])["guard"] for i in ids)}')
print('wall OFF %.1f min, ON %.1f min' % (sum(sig(off[i])['ms'] for i in ids)/6e4, sum(sig(on[i])['ms'] for i in ids)/6e4))
print('\nCHANGED legs (end, ticks, deaths/hits, or refusal text after number-normalisation):')
for i in ids:
    a, b = sig(off[i]), sig(on[i])
    if (a['end'], a['ticks'], a['deaths'], a['hits'], a['norm']) != (b['end'], b['ticks'], b['deaths'], b['hits'], b['norm']):
        print(json.dumps(dict(id=i, key=a['key'], off=dict(end=a['end'], ticks=a['ticks'], deaths=a['deaths'], hits=a['hits'], ms=a['ms'], msg=a['msg'][:220]),
                              on=dict(end=b['end'], ticks=b['ticks'], deaths=b['deaths'], hits=b['hits'], ms=b['ms'], guard=b['guard'], msg=b['msg'][:220])), ensure_ascii=False))
