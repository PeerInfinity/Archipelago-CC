# MEASUREMENT ONLY: one row per leg, one column per replay file: ok/ticks/hits(work)
import json, sys
files = sys.argv[1:]
data = [{json.loads(l)['id']: json.loads(l) for l in open(f)} for f in files]
print('id   ' + ' | '.join(f.split('replay-')[-1][:-6].ljust(26) for f in files))
for i in data[0]:
    cells = []
    for d in data:
        o = d[i]
        cells.append((f"{o['ticks']}t {len(o['hits'])}h w{o['work']} {o['plan']}" if o['ok'] else f"REFUSED({o['kind']}) w{o['work']}").ljust(26))
    print(str(i).ljust(5) + ' | '.join(cells))
