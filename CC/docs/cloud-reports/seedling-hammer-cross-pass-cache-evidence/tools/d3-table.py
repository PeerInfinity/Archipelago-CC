#!/usr/bin/env python3
"""SCRATCH (XC D3): the rounds' walls per workload x mode (median, each round), the cache's ratio, the floor-flip
table, and the norm-md5 of every output (ON must equal OFF's at each floor)."""
import glob, json, os, statistics, subprocess, sys, collections
S = sys.argv[1]
W = collections.defaultdict(list)
for f in sorted(glob.glob(f'{S}/runs/d3-r*-*/*.time')):
    j = json.load(open(f))
    W[(j['wl'], j['mode'].split('-')[-1])].append(j['wall'])
med = lambda k: statistics.median(W[k])
for wl in ('l18', 'A-sword', 'p40'):
    print(f'== {wl}')
    for m in ('off', 'coff', 'on', 'con'):
        print(f'  {m:5} rounds {W[(wl, m)]}  median {med((wl, m)):.1f} s')
    print(f'  cache, floor OFF: {med((wl, "coff")) / med((wl, "off")):.3f}x   cache, floor ON: {med((wl, "con")) / med((wl, "on")):.3f}x')
print('== the floor-flip table (L18 medians)')
o, co, n, cn = (med(('l18', m)) for m in ('off', 'coff', 'on', 'con'))
print(f'  floor ON ÷ floor OFF, no cache:        {n / o:.3f}')
print(f'  floor ON + cache ÷ floor OFF + cache:  {cn / co:.3f}')
print(f'  floor ON + cache ÷ floor OFF (today):  {cn / o:.3f}')
print('== norm-md5 by (workload, mode): one md5 per cell means every round agreed')
md = collections.defaultdict(set)
for f in sorted(glob.glob(f'{S}/runs/d3-r*-*/*.out')):
    m = os.path.basename(os.path.dirname(f)).split('-')[-1]
    md[(os.path.basename(f)[:-4], m)].add(subprocess.run(['python3', f'{S}/tools/norm.py', f], capture_output=True, text=True).stdout.split()[0][:8])
for wl in ('l18', 'A-sword', 'p40'):
    print(f'  {wl:8}', {m: sorted(md[(wl, m)]) for m in ('off', 'coff', 'on', 'con')})
