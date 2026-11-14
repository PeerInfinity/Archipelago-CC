#!/usr/bin/env python3
"""rules-l99-l6-witness: the SKETCHED sided kill-lock rule's effect, as an item-aware sphere sweep over a preset's
committed rules.json (its own placements). NOT a generator run and NOT committed logic: it rewrites one entrance in
memory and compares the sphere (sweep index) of every region and location before and after.

The sketch for L99: `lock@80,96` (tset -1, tag 0) is DURABLE (Lock.check honours persistence while tSet < 0), and its
three lavarunners can be woken and killed only from `level_99__r2c7` (the east side). So an event 'L99 flag 0:
lock@80,96 cleared' lives in r2c7 with the arm rule (HasAny Sword, Ghost Spear), and BOTH crossings of the lock
require that event; from r2c4 the crossing is no longer satisfiable by items alone.

Usage: python3 sided-lock-sweep.py <rules.json>"""
import json, sys
from collections import Counter
d = json.load(open(sys.argv[1]))
regs = d['regions']; regs = regs.get('1', regs)
START = d.get('start_regions', {}).get('1', {}).get('default', ['Menu'])

def ok(r, inv):
    k = r['rule']; a = r.get('args', {})
    if k == 'True_': return True
    if k == 'Has': return inv[a['item_name']] >= a.get('count', 1)
    if k == 'HasAny': return any(inv[i] >= 1 for i in a['item_names'])
    if k == 'HasAll': return all(inv[i] >= 1 for i in a['item_names'])
    if k == 'HasAnyCount': return any(inv[i] >= n for i, n in a['item_counts'].items())
    if k == 'HasAllCounts': return all(inv[i] >= n for i, n in a['item_counts'].items())
    if k == 'And': return all(ok(c, inv) for c in r['children'])
    if k == 'Or': return any(ok(c, inv) for c in r['children'])
    raise ValueError(k)

def sweep(regs):
    # One sweep = one sphere: reach, collect every reachable non-event item; EVENTS are collected to a fixed point
    # inside the sweep (an event costs no sphere, as in AP's own sweep_for_advancements).
    inv = Counter(); got = set(); rsph = {}; lsph = {}; s = 0
    def reach():
        seen = set(START); q = list(START)
        while q:
            r = q.pop()
            for e in regs[r].get('exits', []):
                t = e['connected_region']
                if t not in seen and ok(e['access_rule'], inv): seen.add(t); q.append(t)
        return seen
    def avail(seen, ev):
        return [(l['name'], l['item']['name']) for r in seen for l in regs[r].get('locations', [])
                if l['name'] not in got and bool(l.get('event')) == ev and ok(l['access_rule'], inv)]
    while True:
        while True:
            seen = reach()
            evs = avail(seen, True)
            if not evs: break
            for n, it in evs: got.add(n); lsph[n] = s; inv[it] += 1
        for r in seen: rsph.setdefault(r, s)
        new = avail(seen, False)
        if not new: return rsph, lsph
        for n, it in new: got.add(n); lsph[n] = s; inv[it] += 1
        s += 1

base_r, base_l = sweep(regs)
EV = 'L99 flag 0: lock@80,96 cleared (sketch)'
mod = json.loads(json.dumps(regs))
arm = {'rule': 'HasAny', 'args': {'item_names': ['Ghost Spear', 'Progressive Sword']}}
mod['level_99__r2c7'].setdefault('locations', []).append({'name': EV, 'event': True, 'access_rule': arm, 'item': {'name': EV}})
for src, dst in [('level_99__r2c4', 'level_99__r2c7'), ('level_99__r2c7', 'level_99__r2c4')]:
    for e in mod[src]['exits']:
        if e['connected_region'] == dst: e['access_rule'] = {'rule': 'Has', 'args': {'item_name': EV}}
mod_r, mod_l = sweep(mod)
out = {'rules': sys.argv[1], 'sweeps': max(base_l.values()) + 1,
       'regions_moved': {r: [base_r.get(r), mod_r.get(r)] for r in sorted(set(base_r) | set(mod_r)) if base_r.get(r) != mod_r.get(r)},
       'locations_moved': {n: [base_l.get(n), mod_l.get(n)] for n in sorted(set(base_l) | set(mod_l) - {EV}) if base_l.get(n) != mod_l.get(n)},
       'unreached_after': sorted(set(base_l) - set(mod_l)),
       'l99_regions': {r: [base_r.get(r), mod_r.get(r)] for r in ('level_99__r2c4', 'level_99__r2c7', 'level_100__r2c3')}}
real = {l['name'] for R in regs.values() for l in R.get('locations', []) if not l.get('event')}
out['summary'] = {'regions_moved': len(out['regions_moved']), 'locations_moved': len(out['locations_moved']),
                  'item_locations_unreached_after': sorted(set(out['unreached_after']) & real),
                  'goal_reached_after': 'Level 115 - The Seed' in mod_l, 'goal_sweep': [base_l.get('Level 115 - The Seed'), mod_l.get('Level 115 - The Seed')]}
print(json.dumps(out['summary'] | {'rules': out['rules'], 'l99_regions': out['l99_regions'], 'locations_moved': out['locations_moved']} if len(out['locations_moved']) < 15 else out['summary'] | {'rules': out['rules'], 'l99_regions': out['l99_regions'], 'n_unreached_after': len(out['unreached_after'])}, indent=1))
