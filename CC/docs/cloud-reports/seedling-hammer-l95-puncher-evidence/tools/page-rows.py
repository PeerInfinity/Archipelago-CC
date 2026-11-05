# MEASUREMENT ONLY: the sweep's rows, compacted to {id, key, failed, answer.ok, roomHits max/hits (t, x, y, exact)}.
import json, sys
for l in open(sys.argv[1]):
    r = json.loads(l); a = r.get('answer') or {}
    print(json.dumps({'id': r['id'], 'key': r['key'], 'failed': r['failed'], 'ok': a.get('ok') if isinstance(a, dict) else a,
        'roomHitsMax': (r.get('roomHits') or {}).get('max'),
        'hits': [[h['t'], round(h['x'], 2), round(h['y'], 2), h.get('exact')] for h in (r.get('roomHits') or {}).get('hits', [])],
        'tag': sys.argv[2]}))
