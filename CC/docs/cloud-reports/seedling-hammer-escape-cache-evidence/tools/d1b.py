#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-escape-cache D1, lab v2): repeat rates by key, with the answer compared by its full hash
and by its certificate (ok, claim, bound, keys, states, landing), and the work units (asks, nodes) compared too.
Keys: K1 (run, body, cell, press tick); K2 = K1 + the player state; EXACT (run, run tick, args, globals);
LINEAGE = EXACT across the runs of one segment (forks/rewinds); CONTENT (the world proxy incl. game time, args,
globals) across segments (the two-pass loop's passes).   usage: d1b.py <records.jsonl> [wall_s]"""
import json, sys, collections
recs = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
wall = float(sys.argv[2]) if len(sys.argv) > 2 else None
tot = sum(r['ms'] for r in recs) / 1000
segs = len({r['seg'] for r in recs}); runs = len({r['run'] for r in recs})
print(f"calls {len(recs)} (strike {sum(r['caller'] in ('admission','continuation','walk') for r in recs)}), "
      f"runs {runs}, segments {segs}, escape {tot:.1f} s" + (f" of {wall:.1f} s wall ({100*tot/wall:.1f} %)" if wall else ''))
def rate(name, keyf):
    seen = {}; n = rep = 0; ms = 0.0; c = collections.Counter()
    for r in recs:
        n += 1; k = keyf(r)
        if k is None: continue
        if k in seen:
            f = seen[k]; rep += 1; ms += r['ms'] / 1000
            c['ans'] += f['ans'] == r['ans']; c['cert'] += f['cert'] == r['cert']
            c['okb'] += (f['ok'], f['claim'], f['bound']) == (r['ok'], r['claim'], r['bound'])
            c['asks'] += f['asks'] == r['asks']; c['nodes'] += f['nodes'] == r['nodes']
        else: seen[k] = r
    pct = lambda x: f"{100*x/max(rep,1):.1f}%"
    print(f"  {name:44s} repeat {rep:6d}/{n} ({100*rep/max(n,1):5.1f}%)  their escape s {ms:6.2f} "
          f"({100*ms/max(tot,1e-9):5.1f}% of escape" + (f", {100*ms/wall:5.1f}% of wall)" if wall else ')')
          + f"  same: answer {pct(c['ans'])} cert {pct(c['cert'])} ok/claim/bound {pct(c['okb'])} "
          f"asks {pct(c['asks'])} nodes {pct(c['nodes'])}")
cell = lambda r: tuple(r['cell'] or ())
rate('K1 (run, body, cell, press tick)', lambda r: (r['run'], r['id'], cell(r), r['pressAt']))
rate('K2 = K1 + player state', lambda r: (r['run'], r['id'], cell(r), r['pressAt'], r['player']))
rate('EXACT (run, run tick, args, globals)', lambda r: (r['run'], r['n'], r['args'], r['globals']))
rate('LINEAGE (segment, run tick, args, globals)', lambda r: (r['seg'], r['n'], r['args'], r['globals'], r['world']))
rate('CONTENT (world+time, args, globals), any run', lambda r: (r['world'], r['args'], r['globals']))
