#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-cross-pass-cache D1): the D4 key's share, modelled as the cache would run it.
KEY  = (dg, args, globals, xg): run.stateDigest() before the call, the call's arguments by value, EX's globals (the
       whole CONTACT_FIDELITY, GHOST_SPINNER_PRESS, the deadline none/live/tripped + fine, the progress hook) and the
       solver-side globals (HAMMER_ESCAPE_BOUNDS, PRESS_KILL_COST.enabled).
SCOPE = one twoPassSolve call = one staging (`dgp.staging`: every pass of one residue shares it, residues differ).
STORE = a miss is stored only when its digest did not move across the call (dg == dga: no lazy visit build) — a
       deadline trip is never stored either (none occur here: the sweep installs no deadline; counted anyway).
A HIT is a lookup that finds a stored entry; its first call's answer, asks and nodes must equal the hit's (FALSE = 0).
usage: d1-xc.py <records.jsonl> <pristine_wall_s> [label]"""
import json, sys, statistics, collections
recs = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
wall = float(sys.argv[2])
label = sys.argv[3] if len(sys.argv) > 3 else sys.argv[1]
esc = sum(r['ms'] for r in recs) / 1000
pct = lambda a, b: 100 * a / b if b else 0
store = {}
hits = []; misses = []; notStoredMut = 0; notStoredTrip = 0
anyRepeat = collections.Counter()  # key repeats regardless of storage: within / across runs
first = {}
for r in recs:
    k = (r['dgp']['staging'], r['dg'], r['args'], r['globals'], r['xg'])
    if k in first:
        anyRepeat['same-run' if first[k]['run'] == r['run'] else 'cross-run'] += 1
    else:
        first[k] = r
    if k in store:
        hits.append((store[k], r))
        continue
    misses.append(r)
    if r['bound'] == 'deadline':
        notStoredTrip += 1
    elif r['dg'] != r['dga']:
        notStoredMut += 1
    else:
        store[k] = r
bad = [(f, r) for f, r in hits if (f['ans'], f['asks'], f['nodes']) != (r['ans'], r['asks'], r['nodes'])]
cross = [r for f, r in hits if f['run'] != r['run']]
same = [r for f, r in hits if f['run'] == r['run']]
ms = lambda rs: sum(r['ms'] for r in rs) / 1000
saved = ms([r for _, r in hits])
dgcost = sum(r['dgMs'] for r in recs) / 1000
dgacost = sum(r['dgaMs'] for r in misses) / 1000
net = saved - dgcost - dgacost
solves = len({r['dgp']['staging'] for r in recs})
runs = len({r['run'] for r in recs})
print(f"== {label}")
print(f"calls {len(recs)}, solves (scopes) {solves}, runs (passes) {runs}, escape {esc:.1f} s; pristine wall {wall:.1f} s")
print(f"key repeats (any): same-run {anyRepeat['same-run']} ({pct(anyRepeat['same-run'], len(recs)):.2f}%), "
      f"cross-run {anyRepeat['cross-run']} ({pct(anyRepeat['cross-run'], len(recs)):.1f}%)")
print(f"HITS (modelled cache): {len(hits)} = {pct(len(hits), len(recs)):.1f}% of calls — cross-pass {len(cross)}, "
      f"same-pass {len(same)}; misses {len(misses)} (not stored: digest moved {notStoredMut}, tripped {notStoredTrip}); "
      f"entries {len(store)}, max per scope {max(collections.Counter(k[0] for k in store).values()) if store else 0}")
print(f"FALSE (a hit whose answer|asks|nodes differ from its entry's): {len(bad)}; answer alone: "
      f"{sum(1 for f, r in hits if f['ans'] != r['ans'])}")
print(f"escape time of the hits {saved:.1f} s = {pct(saved, esc):.1f}% of escape, {pct(saved, wall):.1f}% of the pristine wall")
print(f"cost: digest before every call {dgcost:.1f} s (median {statistics.median(r['dgMs'] for r in recs):.3f} ms), "
      f"digest after every miss {dgacost:.1f} s; escape median {statistics.median(r['ms'] for r in recs):.3f} ms")
print(f"NET ≈ {net:.1f} s = {pct(net, wall):.1f}% of the pristine wall (the args' canonical text is not in this lab: D3 times it)")
