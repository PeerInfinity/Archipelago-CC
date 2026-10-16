#!/usr/bin/env python3
# SCRATCH (seedling-hammer-wc D1): aggregate the lab's per-derivation records.
#   wc-d1.py <runs-dir> [<wl> ...]     reads <runs-dir>/lab-off/<wl>.jsonl and lab-on/<wl>.jsonl
import json, sys, os, statistics as st, collections
R = sys.argv[1]
WLS = sys.argv[2:] or ["A-sword", "A-ghost", "leg-397-ghost", "leg-414-ghost", "l18", "ghost-sweep", "campaign",
                       "prod-solve-seedling-r8-l18", "prod-solve-seedling-r8-d2-chain", "killgate-2", "killgate-5",
                       "killgate-9"]
SRC = ["strike:pass", "strike:walk", "strike:cont"]
F = ["n", "samples", "msBody", "msWalkTo", "repeat", "repeatSamples", "suffix", "suffixSamples", "invalid",
     "fullEqualSamples", "entityFreeSamples", "reusableSamples", "prevDerivSamples"]

def load(mode, wl):
    p = f"{R}/lab-{mode}/{wl}.jsonl"
    if not os.path.exists(p):
        return None
    recs, summ = [], []
    for line in open(p):
        if not line.strip():
            continue
        j = json.loads(line)
        (summ if j.get("summary") else recs).append(j)
    return recs, summ

def agg(recs, summ):
    out = {"deriv": len(recs)}
    by = {s: collections.Counter() for s in SRC}
    for r in recs:
        for s, b in r["by"].items():
            for f in F:
                by.setdefault(s, collections.Counter())[f] += b.get(f, 0)
    out["by"] = by
    out["ms"] = sum(r["ms"] for r in recs)
    out["escMs"] = sum(r["escMs"] for r in recs)
    out["escN"] = sum(r["escN"] for r in recs)
    kills = collections.Counter((r["pid"], r["kill"]) for r in recs)
    out["kills"] = len(kills)
    out["perKill"] = sorted(kills.values())
    # consecutive derivations in one kill (top-level ones: ordered by id within (pid, kill))
    seq = collections.defaultdict(list)
    for r in recs:
        seq[(r["pid"], r["kill"])].append(r)
    same_state = same_key = hit_moved = tot = 0
    dts = collections.Counter()
    for k, rs in seq.items():
        rs.sort(key=lambda r: r["id"])
        for a, b in zip(rs, rs[1:]):
            tot += 1
            dts[min(b["t"] - a["t"], 5)] += 1
            same_state += a["state"] == b["state"]
            same_key += a["stepKey"] == b["stepKey"] and a["stepKey"] is not None
            hit_moved += a["hits"] != b["hits"]
    out["pairs"] = tot
    out["sameState"] = same_state
    out["sameStepKey"] = same_key
    out["hitMoved"] = hit_moved
    out["dt"] = dict(sorted(dts.items()))
    cal = collections.Counter(); calms = collections.Counter(); caln = collections.Counter()
    for s in summ:
        for c, b in s["byCaller"].items():
            cal[c] += b["samples"]; calms[c] += b["ms"]; caln[c] += b["n"]
    out["callers"] = {c: (caln[c], cal[c], round(calms[c] / 1000, 2)) for c in cal}
    out["killMs"] = sum(s["killMs"] for s in summ)
    out["derivMs"] = sum(s["derivMs"] for s in summ)
    return out

def pct(a, b):
    return f"{100 * a / b:.1f}%" if b else "—"

rows = []
for wl in WLS:
    for mode in ("off", "on"):
        L = load(mode, wl)
        if L is None:
            continue
        a = agg(*L)
        tot = collections.Counter()
        for s in a["by"].values():
            tot.update(s)
        pk = a["perKill"]
        print(f"## {wl} — floor {mode.upper()}")
        print(f"derivations {a['deriv']} in {a['kills']} kills (per kill: median {st.median(pk) if pk else 0}, max {max(pk) if pk else 0});"
              f" consecutive pairs {a['pairs']}: same player state {pct(a['sameState'], a['pairs'])},"
              f" same stepper inputs {pct(a['sameStepKey'], a['pairs'])}, a hit between {pct(a['hitMoved'], a['pairs'])}, Δt {a['dt']}")
        print(f"executor (kill) {a['killMs']/1000:.1f}s · deriveStrike {a['ms']/1000:.1f}s · strikeEscape {a['escMs']/1000:.1f}s"
              f" ({a['escN']} calls) · walkTo {tot['msWalkTo']/1000:.1f}s (previewWalk body {tot['msBody']/1000:.1f}s)")
        print("previewWalk by caller (n, samples, s):", a["callers"])
        for s in SRC:
            b = a["by"].get(s)
            if not b or not b["n"]:
                continue
            print(f"  {s:12} previews {b['n']:7} ({b['n']/a['deriv']:.2f}/deriv) samples {b['samples']:9} ({b['samples']/a['deriv']:.1f}/deriv)"
                  f" | repeat {b['repeatSamples']} suffix {b['suffixSamples']} (of which prev-deriv {b['prevDerivSamples']})"
                  f" INVALID {b['invalid']} | entity-free {pct(b['entityFreeSamples'], b['samples'])}"
                  f" | EXACT-REUSABLE {b['reusableSamples']} ({pct(b['reusableSamples'], b['samples'])})"
                  f" | full-equal {b['fullEqualSamples']} ({pct(b['fullEqualSamples'], b['samples'])})")
        print(f"  ALL          samples {tot['samples']} · exact-reusable {tot['reusableSamples']} ({pct(tot['reusableSamples'], tot['samples'])})"
              f" · matched (any) {tot['repeatSamples'] + tot['suffixSamples']} · full-equal {tot['fullEqualSamples']} · invalid {tot['invalid']}")
        print()
        rows.append({"wl": wl, "mode": mode, **{k: v for k, v in a.items() if k not in ("by", "perKill")},
                     "tot": dict(tot), "by": {k: dict(v) for k, v in a["by"].items()}})
json.dump(rows, open(f"{R}/d1-summary.json", "w"), indent=1)
