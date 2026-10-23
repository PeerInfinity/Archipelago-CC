import json, sys
for f in sys.argv[1:]:
    rows = [json.loads(l) for l in open(f) if l.startswith('{')]
    n = len(rows)
    offhit = [r for r in rows if r.get('off', {}).get('hits')]
    onhit = [r for r in rows if r.get('on', {}).get('hits')]
    offerr = [r for r in rows if 'error' in r.get('off', {})]
    onerr = [r for r in rows if 'error' in r.get('on', {})]
    rules = {}
    for r in rows:
        c = r.get('on', {}).get('choice')
        k = c['rule'] if c else ('error' if 'error' in r.get('on', {}) else 'none')
        rules[k] = rules.get(k, 0) + 1
    dt = [r['on']['ticks'] - r['off']['ticks'] for r in rows if 'ticks' in r.get('on', {}) and 'ticks' in r.get('off', {})]
    hl = [r['on']['choice']['hitless'] for r in rows if r.get('on', {}).get('choice')]
    print(f"{f.split('/')[-1]}: n={n} OFF-commits-hit={len(offhit)} ON-commits-hit={len(onhit)} OFF-err={len(offerr)} ON-err={len(onerr)} rules={rules}"
          f" hitless-variants/seed min={min(hl) if hl else None} mean={sum(hl)/len(hl) if hl else None:.2f}"
          f" ticks ON-OFF mean={sum(dt)/len(dt) if dt else 0:.0f} max={max(dt) if dt else 0} changed={sum(1 for d in dt if d)}")
    for r in offhit + onhit + offerr + onerr:
        print('   ', json.dumps(r)[:400])
