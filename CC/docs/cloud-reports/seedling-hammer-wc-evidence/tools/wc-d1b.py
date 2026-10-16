#!/usr/bin/env python3
# SCRATCH (seedling-hammer-wc D1): lab 2 / lab 3 extras — the join rule, what the stepper inputs changed on between
# consecutive derivations, the escape's repeat bound (lab 2), and the danger verdict on repeats (lab 3).
#   wc-d1b.py <dir with <wl>.jsonl> [<wl> ...]
import json, sys, os, collections
D = sys.argv[1]
WLS = sys.argv[2:] or sorted(f[:-6] for f in os.listdir(D) if f.endswith('.jsonl'))
for wl in WLS:
    recs, summ = [], []
    for line in open(f"{D}/{wl}.jsonl"):
        if line.strip():
            j = json.loads(line)
            (summ if j.get('summary') else recs).append(j)
    tot = collections.Counter()
    for r in recs:
        for b in r['by'].values():
            tot.update({k: v for k, v in b.items() if isinstance(v, (int, float))})
    print(f"## {wl}  ({len(recs)} derivations)")
    print(f"  samples {tot['samples']}  repeat {tot['repeatSamples']}  suffix {tot['suffixSamples']}  "
          f"join {tot['joinSamples']} ({tot['join']} previews, entity-free {tot['joinFreeSamples']}, invalid {tot['joinInvalid']})  "
          f"exact-reusable (repeat+suffix, entity-free) {tot['reusableSamples']}")
    if 'repUnsafeEq' in tot or 'repUnsafeDiff' in tot:
        print(f"  repeats: danger verdict equal {tot['repUnsafeEq']}, differs {tot['repUnsafeDiff']} "
              f"(of which full-equal samples but a different verdict: {tot['repFullEqUnsafeDiff']})")
    seq = collections.defaultdict(list)
    for r in recs:
        seq[(r['pid'], r['kill'])].append(r)
    parts = collections.Counter(); pairs = 0
    for rs in seq.values():
        rs.sort(key=lambda r: r['id'])
        for a, b in zip(rs, rs[1:]):
            pa, pb = a.get('stepKeyParts'), b.get('stepKeyParts')
            if not pa or not pb:
                continue
            pairs += 1
            ch = [k for k in ('w', 'd', 'p', 'f') if pa[k] != pb[k]]
            ch += ['r.' + k for k in set(pa['r']) | set(pb['r']) if pa['r'].get(k) != pb['r'].get(k)]
            parts[tuple(sorted(ch)) or ('(none)',)] += 1
    print(f"  stepper inputs between consecutive derivations ({pairs} pairs):",
          ', '.join(f"{'+'.join(k)}: {v}" for k, v in parts.most_common(8)))
    for s in summ:
        e = s.get('escR')
        if e:
            print(f"  escape (pid {s['pid']}): {e['n']} calls {e['ms']/1000:.1f}s · same (body, cell, pressAt) asked earlier in"
                  f" the kill: {e['rep']} ({e['repMs']/1000:.1f}s), same answer {e['repEq']} ({e['repEqMs']/1000:.1f}s) ·"
                  f" + same player state: {e['repS']} ({e['repSMs']/1000:.1f}s), same answer {e['repSEq']}")
    print()
