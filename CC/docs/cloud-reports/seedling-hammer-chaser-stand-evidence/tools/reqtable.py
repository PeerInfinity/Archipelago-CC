# MEASUREMENT-ONLY (chaser-stand): the request matrix (one JSON line per request x variant) -> one row per request.
import json, sys
rows = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
order = sys.argv[2].split(',')
by = {}
for d in rows:
    k = f"{d.get('src', d.get('job'))} seam{d.get('seam', 0):+d}"
    by.setdefault(k, {})[d.get('variant')] = d
def f(d):
    if not d: return '-'
    if d.get('error'): return 'ERR'
    if not d['ok']:
        m = d['msg'] or ''
        why = 'deadline' if 'shouldStop' in m else ('reboot' if 'reboots the room' in m else ('latched hold' if 'the hold stands still' in m else 'rung'))
        return f"REFUSED ({why}) `{d['answer']}`"
    hs = ' '.join(h.split(' <-')[0] for h in d['hits'])
    return f"{d['ticks']} t, {len(d['hits'])} h{(' ' + hs) if hs else ''} `{d['answer']}`"
print('| request | ' + ' | '.join(order) + ' |'); print('|' + '---|' * (len(order) + 1))
for k in sorted(by): print(f"| {k} | " + ' | '.join(f(by[k].get(v)) for v in order) + ' |')
