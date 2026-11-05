# MEASUREMENT ONLY: two replay files of the same requests: per (id, i) equal on ok/kind/ticks/plan/work/message/hits?
import json, sys
def load(f): return {(o['id'], o['i']): o for o in map(json.loads, open(f))}
a, b = load(sys.argv[1]), load(sys.argv[2]); keys = ['ok', 'kind', 'ticks', 'plan', 'work', 'message', 'hits']
movers = [k for k in a if k in b and any(a[k].get(x) != b[k].get(x) for x in keys)]
ok = lambda d: sum(1 for o in d.values() if o['ok'])
print(f"{len(a)} / {len(b)} requests; ok {ok(a)} / {ok(b)}; refused {len(a)-ok(a)} / {len(b)-ok(b)}; movers {len(movers)}")
for k in movers:
    print('  mover', k, a[k]['key'][:90], '|', {x: (a[k].get(x), b[k].get(x)) for x in keys if a[k].get(x) != b[k].get(x) and x != 'message'})
