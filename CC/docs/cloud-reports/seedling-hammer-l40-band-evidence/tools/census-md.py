# LB — the report's census section: per leg, one row per seam time, the class and units in each of the four arms
# (defaults / walls+blast, guards OFF / ON), then the class counts and the median `ms` per arm. Measure only.
#   python3 census-md.py > d2/census.md
import json, statistics, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from cls import cls  # noqa: E402  (tools/cls.py)
from collections import Counter
ARMS = [('defaults, OFF', 'd1/census/c{leg}-def.jsonl'), ('defaults, guards ON', 'd2/census/c{leg}-def-guards.jsonl'),
        ('walls+blast, OFF', 'd1/census/c{leg}-wb.jsonl'), ('walls+blast, guards ON', 'd2/census/c{leg}-wb-guards.jsonl')]
for leg in ('414', '397'):
    data = []
    for name, pat in ARMS:
        p = pat.format(leg=leg)
        rows = {}
        if os.path.exists(p):
            for l in open(p):
                r = json.loads(l)
                rows[r['seamTime']] = r
        data.append((name, rows))
    times = sorted(set(t for _, rows in data for t in rows))
    print(f'**Leg {leg}** (seam times {times[0]}–{times[-1]}; class, work units):\n')
    print('| seam | ' + ' | '.join(n for n, _ in data) + ' |')
    print('|---|' + '---|' * len(data))
    for t in times:
        cells = []
        for _, rows in data:
            r = rows.get(t)
            cells.append('—' if r is None else f'{cls(r)}, {r.get("work")}')
        print(f'| {t} | ' + ' | '.join(cells) + ' |')
    print()
    for name, rows in data:
        c = Counter(cls(r) for r in rows.values())
        ms = [r.get('ms') for r in rows.values() if r.get('ms')]
        med = f', median {statistics.median(ms) / 1000:.0f} s a seam (loaded box)' if ms else ''
        print(f'- {name} ({len(rows)}): ' + ', '.join(f'{k} {v}' for k, v in c.most_common()) + med)
    print()
