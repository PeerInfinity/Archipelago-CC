# scratch: the divergence sweep's --out rows as a TSV (id, key, end, plan ticks, room hits, divergences, failure head)
import json, sys
print('id\tkey\tend\tticks\troomHits\tdivs\ttext')
for l in open(sys.argv[1]):
    r = json.loads(l)
    p = (r.get('plans') or [{}])[-1]
    print('\t'.join(str(x) for x in [r['id'], r['key'], r['end'], p.get('ticks'), (r.get('roomHits') or {}).get('max'),
        len(r.get('divs') or []), (p.get('message') or '').replace('\n', ' ')[:300]]))
