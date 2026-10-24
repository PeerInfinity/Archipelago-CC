#!/usr/bin/env python3
"""SCRATCH (seedling-hammer-sf2 D3): the timing table and answer stability over the interleaved rounds.
Modes: off (head, OFF), a (base, ON = SF's shape a), k16 (head, ON = the cap). usage: d3-table.py <S> <rounds...>"""
import json, os, subprocess, sys, statistics as st
S = sys.argv[1]; R = sys.argv[2:]
WL = ['A-sword', 'A-ghost', 'leg-397-ghost', 'leg-414-ghost', 'l18', 'ghost-sweep', 'campaign',
      'prod-solve-seedling-r8-l18', 'prod-solve-seedling-r8-d2-chain', 'killgate-2', 'killgate-5', 'killgate-9']
M = ['off', 'a', 'k16']
def norm(p): return subprocess.run(['python3', f'{S}/tools/norm.py', p], capture_output=True, text=True).stdout.split()[0][:8]
print('| workload | mode | answer (stable over rounds?) | rc | walls s [load] | median / min | ÷ OFF (median) |')
print('|---|---|---|---|---|---|---|')
for w in WL:
    med = {}
    for m in M:
        walls = []; ans = set(); rcs = set(); cells = []
        for r in R:
            d = f'{S}/d3-{r}-{m}'
            t = json.load(open(f'{d}/{w}.time')); walls.append(t['wall']); rcs.add(t['rc'])
            ans.add(norm(f'{d}/{w}.out')); cells.append(f"{t['wall']} [{t['load']}]")
        med[m] = st.median(walls)
        ratio = '' if m == 'off' else f"{med[m] / med['off']:.2f}×"
        print(f"| {w} | {m} | {'`' + ', '.join(sorted(ans)) + '`'}{'' if len(ans) == 1 else ' ⚠ UNSTABLE'} | {','.join(map(str, sorted(rcs)))} "
              f"| {', '.join(cells)} | {med[m]:.1f} / {min(walls):.1f} | {ratio} |")
