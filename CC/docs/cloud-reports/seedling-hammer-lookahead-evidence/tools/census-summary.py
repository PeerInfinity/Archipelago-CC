#!/usr/bin/env python3
"""LOOKAHEAD census summary: the rows of census-run.sh grouped by (region, arrival door, AP-equivalent sibling group).
A group is the exits of one region with the same connected_region, the same access_rule and the same target level
(the playthrough rules + sidecars). For each (arrival, group): every member's shipped plan, its hits split by level,
and the verdict:
  MOVABLE   the member the AP path names (the group's first, un-numbered name) hits, and a sibling is hitless
  ALL-HIT   every planned member hits
  CLEAN     the named member is hitless (nothing to move)
  UNKNOWN   the named member has no plan, or no sibling has a plan
  python3 census-summary.py <evidence dir>
"""
import collections
import glob
import json
import sys

E = sys.argv[1]
rules = json.load(open('worlds/seedling_playthrough/_worldgen_rules.json'))
side = json.load(open('worlds/seedling_playthrough/_worldgen_sidecars.json'))
rule = {}


def find(o):
    if isinstance(o, dict):
        if 'connected_region' in o and 'name' in o:
            rule[o['name']] = (o['connected_region'], json.dumps(o.get('access_rule'), sort_keys=True))
        for v in o.values():
            find(v)
    elif isinstance(o, list):
        for v in o:
            find(v)


find(rules)
gid = {}
order = {}
for reg, v in side.items():
    for i, e in enumerate((v.get('playable_payload') or {}).get('exits', [])):
        if not e.get('exitName'):
            continue
        cr, ar = rule.get(e['exitName'], (None, None))
        gid[(reg, e['exit_id'])] = (reg, cr, ar, e['target_level'])
        order[(reg, e['exit_id'])] = (e['exitName'].count('#'), i, e['exitName'])
rows = [json.loads(l) for p in [f'{E}/census/census.jsonl'] for l in open(p) if l.strip()]
groups = collections.defaultdict(list)
for r in rows:
    k = r['key']
    region = k.split(' <- ')[0]
    arrival = k.split(' <- ')[1].split(' -> ')[0]
    ex = k.split(' -> exit:')[-1]
    g = gid.get((region, ex))
    groups[(arrival, g)].append((order[(region, ex)], ex, r))
verdicts = collections.Counter()
lines = []
for (arrival, g), mem in sorted(groups.items(), key=lambda x: str(x[0])):
    mem.sort()
    named = mem[0]
    def hits(r):
        return sum((r.get('hitsByLevel') or {}).values()) if r.get('shipped') else None
    hn = hits(named[2])
    sib = [(m[1], hits(m[2])) for m in mem[1:]]
    if named[0][0] != 0 or hn is None or all(h is None for _, h in sib):
        v = 'UNKNOWN'
    elif hn == 0:
        v = 'CLEAN'
    elif any(h == 0 for _, h in sib):
        v = 'MOVABLE'
    else:
        v = 'ALL-HIT'
    verdicts[v] += 1
    lines.append(f'{v:8} {g[0]} <- {arrival} => {g[1]} (L{g[3]}): named {named[1]} '
                 + f'{named[2].get("shipped")} {named[2].get("hitsByLevel")} {named[2].get("outcome", "")}; siblings '
                 + ', '.join(f'{m[1]} {m[2].get("shipped")} {m[2].get("hitsByLevel")} {m[2].get("outcome", "")}'.strip() for m in mem[1:]))
print(f'{len(rows)} rows, {len(groups)} (arrival, group) pairs: {dict(verdicts)}')
print('\n'.join(lines))
