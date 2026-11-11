# cut one captured page request (probe-seedling-divergence-sweep --capture-requests) to a test fixture: the leg's request --i, its atlas
# records cut to the boot level, gzip (mtime 0). Usage: cutfixture.py <requests.jsonl> <id> <i> <out.json.gz>
import json, gzip, sys
src, lid, i, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
row = [r for r in map(json.loads, open(src)) if r['id'] == lid][0]
c = [c for c in row['requests'] if c['i'] == i][0]
lvl = c['request']['staging']['boot']['level']
c['request']['source']['records']['__map'] = [e for e in c['request']['source']['records']['__map'] if e[0] == lvl]
fx = {'id': row['id'], 'key': row['key'], 'requests': [{'i': c['i'], 'request': c['request'], 'passes': c['passes']}]}
with open(out, 'wb') as fh:
    with gzip.GzipFile(fileobj=fh, mode='wb', mtime=0, filename='') as g: g.write(json.dumps(fx, separators=(',', ':')).encode())
print(out, lvl, len(open(out, 'rb').read()))
