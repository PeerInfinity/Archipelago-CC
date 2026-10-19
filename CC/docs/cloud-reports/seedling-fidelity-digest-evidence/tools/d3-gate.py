#!/usr/bin/env python3
"""SCRATCH (seedling-fidelity-digest D3.1/D3.2/D2 cost): read the digest lab's records.
  FALSE EQUAL: a call whose key DIGEST = (dg, args, globals) was seen before with a DIFFERENT answer (full answer
               hash; the asks and nodes too). Must be 0.
  SHARE:       of EX's CONTENT repeats (world proxy + args + globals seen before), how many are also DIGEST repeats;
               and both as a share of the escape's time and of the wall.
  COST:        dgMs against the escape's own ms (strike callers and all), medians.
  FRESH:       records whose every-k-th fresh digest differs from the memo digest (a world edited in place).
usage: d3-gate.py <records.jsonl> [wall_s]"""
import json, sys, statistics, collections
recs = [json.loads(l) for l in open(sys.argv[1]) if l.strip()]
wall = float(sys.argv[2]) if len(sys.argv) > 2 else None
esc = sum(r['ms'] for r in recs) / 1000
STRIKE = ('admission', 'continuation', 'walk')
print(f"calls {len(recs)} (strike {sum(r['caller'] in STRIKE for r in recs)}), runs {len({r['run'] for r in recs})}, "
      f"segments {len({r['seg'] for r in recs})}, escape {esc:.1f} s" + (f" of {wall:.1f} s wall" if wall else ''))
def repeats(keyf):
    seen = {}; out = []
    for r in recs:
        k = keyf(r)
        if k in seen: out.append((seen[k], r))
        else: seen[k] = r
    return out
dig = lambda r: (r['dg'], r['args'], r['globals'])
con = lambda r: (r['world'], r['args'], r['globals'])
D = repeats(dig); C = repeats(con)
bad = [(f, r) for f, r in D if (f['ans'], f['asks'], f['nodes']) != (r['ans'], r['asks'], r['nodes'])]
badAns = [(f, r) for f, r in D if f['ans'] != r['ans']]
print(f"FALSE EQUAL (digest+args+globals equal, answer differs): {len(badAns)}  (answer|asks|nodes differs: {len(bad)})")
for f, r in bad[:5]:
    print('   e.g.', {k: (f[k], r[k]) for k in ('run', 'n', 'seg', 'caller', 'ans', 'asks', 'nodes')})
cd = {id(r) for _, r in D}; cc = {id(r) for _, r in C}
both = [r for _, r in C if id(r) in cd]
ms = lambda rs: sum(r['ms'] for r in rs) / 1000
pct = lambda a, b: 100 * a / b if b else 0
print(f"DIGEST repeats {len(D)} ({pct(len(D), len(recs)):.1f}% of calls; {ms([r for _, r in D]):.2f} s = "
      f"{pct(ms([r for _, r in D]), esc):.1f}% of escape" + (f", {pct(ms([r for _, r in D]), wall):.1f}% of wall)" if wall else ')'))
print(f"CONTENT repeats {len(C)} ({pct(len(C), len(recs)):.1f}% of calls; {ms([r for _, r in C]):.2f} s = "
      f"{pct(ms([r for _, r in C]), esc):.1f}% of escape" + (f", {pct(ms([r for _, r in C]), wall):.1f}% of wall)" if wall else ')'))
print(f"SHARE: digest also matches {len(both)}/{len(C)} = {pct(len(both), len(C)):.1f}% of CONTENT repeats "
      f"({pct(ms(both), ms([r for _, r in C])):.1f}% of their escape time"
      + (f"; {pct(ms(both), wall):.1f}% of wall)" if wall else ')'))
onlyD = [r for _, r in D if id(r) not in cc]
print(f"digest repeats that are NOT content repeats: {len(onlyD)}")
miss = [r for _, r in C if id(r) not in cd]
if miss:
    # which component differs from the content-first's?
    first = {}
    for r in recs:
        k = con(r)
        first.setdefault(k, r)
    comp = collections.Counter()
    for r in miss:
        f = first[con(r)]
        for k in r['dgp']:
            if r['dgp'][k] != f['dgp'][k]: comp[k] += 1
    print('  content repeats the digest misses, by differing component (vs the content-first call):', dict(comp))
dms = [r['dgMs'] for r in recs]; ems = [r['ms'] for r in recs]
sms = [r['ms'] for r in recs if r['caller'] in STRIKE]; sdm = [r['dgMs'] for r in recs if r['caller'] in STRIKE]
print(f"COST: digest median {statistics.median(dms):.3f} ms (p90 {sorted(dms)[int(.9*len(dms))]:.3f}, max {max(dms):.2f}); "
      f"escape median {statistics.median(ems):.3f} ms; strike callers: escape median {statistics.median(sms):.3f} ms, "
      f"digest {statistics.median(sdm):.3f} ms → ratio {statistics.median(sdm)/statistics.median(sms):.3f}; "
      f"digest total {sum(dms)/1000:.2f} s vs escape {esc:.1f} s")
fr = [r for r in recs if r.get('dgFresh')]
print(f"FRESH: {len(fr)} sampled, {sum(r['dgFresh'] != r['dg'] for r in fr)} differ from the memo digest")
