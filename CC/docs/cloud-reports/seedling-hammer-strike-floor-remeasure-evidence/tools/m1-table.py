#!/usr/bin/env python3
"""SCRATCH (SF3 M1): the timing table, answer stability over the interleaved rounds, and the XC counts per run.
SF2's d3-table.py re-cut for two modes (off, on) and runs/r<k>-<mode>/. usage: m1-table.py <S>"""
import json, subprocess, sys, statistics as st
S = sys.argv[1]; R = ['r1', 'r2', 'r3']
WL = ['A-sword', 'A-ghost', 'leg-387-ghost', 'leg-404-ghost', 'l18', 'ghost-sweep', 'campaign',
      'prod-solve-seedling-r8-l18', 'prod-solve-seedling-r8-d2-chain', 'killgate-2', 'killgate-5', 'killgate-9']
M = ['off', 'on']
def norm(p): return subprocess.run(['python3', f'{S}/tools/norm.py', p], capture_output=True, text=True).stdout.split()[0][:8]
def xc(p):
    tot = {}
    for line in open(p):
        for k, v in json.loads(line)['counts'].items(): tot[k] = tot.get(k, 0) + v
    return tot
print('| workload | mode | answer (stable over rounds?) | rc | walls s [load] | median / min | ÷ OFF (median) | XC lookups / hits (r1) |')
print('|---|---|---|---|---|---|---|---|')
for w in WL:
    med = {}
    for m in M:
        walls = []; ans = set(); rcs = set(); cells = []; xcs = set()
        for r in R:
            d = f'{S}/runs/{r}-{m}'
            try: t = json.load(open(f'{d}/{w}.time'))
            except FileNotFoundError: continue
            walls.append(t['wall']); rcs.add(t['rc'])
            ans.add(norm(f'{d}/{w}.out')); cells.append(f"{t['wall']} [{t['load']}]")
            c = xc(f'{d}/{w}.xc.jsonl'); xcs.add((c.get('lookups', 0), c.get('hits', 0)))
        if not walls: continue
        med[m] = st.median(walls)
        ratio = '' if m == 'off' or 'off' not in med else f"{med[m] / med['off']:.2f}×"
        x = ', '.join(f'{a:,} / {b:,}' for a, b in sorted(xcs))
        print(f"| {w} | {m} | {'`' + ', '.join(sorted(ans)) + '`'}{'' if len(ans) == 1 else ' ⚠ UNSTABLE'} | {','.join(map(str, sorted(rcs)))} "
              f"| {', '.join(cells)} | {med[m]:.1f} / {min(walls):.1f} | {ratio} | {x} |")
