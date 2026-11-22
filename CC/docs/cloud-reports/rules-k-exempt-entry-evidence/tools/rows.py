"""rules-k-exempt-entry: summarise kw.mjs ROW lines (usage: rows.py <log>)."""
import sys, json
for l in open(sys.argv[1]):
    if not l.startswith('ROW '): continue
    r = json.loads(l[4:])
    if 'error' in r: print(r['arm'], 'ERROR', r['error']); continue
    cr = r.get('closestRunner')
    print(f"{r['arm']:<26} hitsEnd={r['hits']} total={r.get('totalHits')} deaths={len(r['deaths'])} left={r['leftLevelAt'] and (r['leftLevelAt']['level'], r['leftLevelAt']['t'])}"
          f" reels={[(p['t'], p['start']['tile'], p['end']['tile']) for p in r['pulls']]} items={r.get('items')}"
          f" closest={cr and (cr['t'], cr['dMin'], cr['player'], [b for b in cr['bodies'] if b[0]=='LavaRunner'])} samples={r['bodySamples']}")
    for c in r['contacts']: print(f"    hit{c['hit']} t{c['t']} {c['player']['tile']} {[(b['cls'], b['x'], b['y'], b['d']) for b in c['nearestBodies'][:2]]}")
    for d in r['deaths']: print(f"    death respawn t{d['respawnT']} last {d['lastAlive']['tile']} {d.get('killingContact', {}).get('nearestBodies', [])[:1]}")
