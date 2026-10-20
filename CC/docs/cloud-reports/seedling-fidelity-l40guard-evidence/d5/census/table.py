# L40GUARD census table: per leg, seam x {defaults OFF, defaults ON, walls+blast OFF, walls+blast ON}; LB's cls.py classes
import json, sys, os, statistics
sys.path.insert(0, '/home/user/Archipelago-CC/CC/docs/cloud-reports/seedling-hammer-l40-band-evidence/tools')
from cls import cls
from collections import Counter
D = sys.argv[1]
ARMS = [('defaults, OFF', 'def-off'), ('defaults, ON', 'def-on'), ('walls+blast, OFF', 'wb-off'), ('walls+blast, ON', 'wb-on')]
for leg in ('414', '397'):
    rows = {}
    for name, k in ARMS:
        p = f'{D}/c-{leg}-{k}.jsonl'
        if not os.path.exists(p): continue
        for l in open(p):
            r = json.loads(l); rows.setdefault(name, {})[r['seamTime']] = (cls(r), r.get('work'), r.get('ms'))
    arms = [a for a, _ in ARMS if a in rows]
    times = sorted(set(t for a in arms for t in rows[a]))
    print(f'\n**Leg {leg}** (seam; class, work units):\n')
    print('| seam | ' + ' | '.join(arms) + ' |'); print('|---|' + '---|' * len(arms))
    for t in times:
        print(f'| {t} | ' + ' | '.join((lambda x: f'{x[0]}, {x[1]}' if x else '—')(rows[a].get(t)) for a in arms) + ' |')
    print()
    for a in arms:
        c = Counter(v[0] for v in rows[a].values()); ms = [v[2] for v in rows[a].values() if v[2]]
        print(f'- {a} ({len(rows[a])}): ' + ', '.join(f'{k} {n}' for k, n in c.most_common()) + (f'; median {statistics.median(ms)/1000:.0f} s a seam (loaded box)' if ms else ''))
